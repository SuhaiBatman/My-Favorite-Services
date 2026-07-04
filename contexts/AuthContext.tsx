import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { syncRealtimeAuth } from '../lib/realtimeSubscribe';
import {
  hasRole as checkRole,
  normalizeRoles,
  primaryRoleFromRoles,
  rolesForPrimaryRole,
  SELF_EMPLOYED_ROLES,
  type UserRole,
} from '../lib/roles';

type ProfileData = {
  first_name?: string;
  last_name?: string;
  middle_initial?: string;
  age?: string;
  gender?: string;
  phone?: string;
  email?: string;
  business_name?: string;
  job_title?: string;
  timings?: string;
  work_days?: string;
  flexible_hours?: boolean;
  role?: UserRole | string;
  roles?: UserRole[] | string[];
  bio?: string;
  services?: string;
  industry?: string;
  business_description?: string;
  website?: string;
  location?: string;
  is_self_employed?: boolean;
  interests?: string;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  /** Primary role for onboarding / legacy UI (employee > business > user) */
  role: UserRole | null;
  /** All active roles — employees include `user` for consumer features */
  roles: UserRole[];
  hasRole: (role: UserRole) => boolean;
  isLoading: boolean;
  setRole: (role: UserRole, options?: { isSelfEmployed?: boolean }) => Promise<void>;
  updateProfile: (
    data: ProfileData,
    options?: { profileTableOnly?: boolean }
  ) => Promise<void>;
  /** One profile write for onboarding finish — avoids duplicate auth/profile round-trips. */
  completeOnboarding: (
    data: ProfileData,
    primaryRole: UserRole,
    isSelfEmployed: boolean
  ) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  roles: [],
  hasRole: () => false,
  isLoading: true,
  setRole: async () => {},
  updateProfile: async () => {},
  completeOnboarding: async () => {},
});

const AUTH_METADATA_KEYS = [
  'first_name',
  'last_name',
  'middle_initial',
  'age',
  'gender',
  'phone',
  'email',
  'role',
  'roles',
  'is_self_employed',
  'job_title',
  'business_name',
] as const;

function slimAuthMetadata(payload: ProfileData): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  for (const key of AUTH_METADATA_KEYS) {
    const value = payload[key as keyof ProfileData];
    if (value !== undefined) slim[key] = value;
  }
  return slim;
}

export const useAuth = () => useContext(AuthContext);

function applySessionUser(sessionUser: User | null) {
  const meta = sessionUser?.user_metadata ?? {};
  const isSelfEmployed = Boolean(meta.is_self_employed);
  const roles = normalizeRoles(meta.role, meta.roles, isSelfEmployed);
  const primary = primaryRoleFromRoles(roles);
  return { roles, primary, isSelfEmployed };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [roles, setRolesState] = useState<UserRole[]>([]);
  const [isSelfEmployed, setIsSelfEmployed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const suppressHydrateUntilRef = useRef(0);

  const syncFromUser = (sessionUser: User | null) => {
    const { roles: nextRoles, primary, isSelfEmployed: selfEmployed } =
      applySessionUser(sessionUser);
    setRolesState(nextRoles);
    setRoleState(primary);
    setIsSelfEmployed(selfEmployed);
  };

  const syncFromProfileRow = (row: {
    role: string | null;
    roles: string[] | null;
    is_self_employed: boolean | null;
  }) => {
    const selfEmployed = Boolean(row.is_self_employed);
    const nextRoles = normalizeRoles(row.role, row.roles, selfEmployed);
    setRolesState(nextRoles);
    setRoleState(primaryRoleFromRoles(nextRoles));
    setIsSelfEmployed(selfEmployed);
  };

  const hydrateRolesFromProfile = useCallback(async (sessionUser: User) => {
    if (Date.now() < suppressHydrateUntilRef.current) {
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('role, roles, is_self_employed')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (!data) {
      syncFromUser(sessionUser);
      return;
    }

    // Profile is the source of truth — avoids clearing roles from stale JWT metadata
    // during TOKEN_REFRESHED / USER_UPDATED events while Home is loading.
    syncFromProfileRow(data);

    const selfEmployed = Boolean(data.is_self_employed);
    const fromDb = normalizeRoles(data.role, data.roles, selfEmployed);
    const fromMeta = applySessionUser(sessionUser).roles;
    const metaMissingUser =
      fromDb.includes('employee') &&
      fromDb.includes('user') &&
      !fromMeta.includes('user');
    const metaMissingSelfEmployedRoles =
      selfEmployed &&
      SELF_EMPLOYED_ROLES.some(r => !fromMeta.includes(r));

    // Only backfill auth when metadata is empty or employee is missing the bundled
    // `user` role. Do not compare array lengths — that reverts intentional role switches
    // (e.g. business → employee) while the profile row is still stale.
    const metaEmpty = fromMeta.length === 0;

    if (fromDb.length && (metaEmpty || metaMissingUser || metaMissingSelfEmployedRoles)) {
      const primary = primaryRoleFromRoles(fromDb);
      if (primary) {
        if (metaMissingSelfEmployedRoles) {
          await supabase
            .from('profiles')
            .update({ roles: fromDb, updated_at: new Date().toISOString() })
            .eq('id', sessionUser.id);
        }
        await supabase.auth.updateUser({
          data: {
            role: primary,
            roles: fromDb,
            is_self_employed: selfEmployed,
          },
        });
        const { data: refreshed } = await supabase.auth.getUser();
        if (refreshed.user) {
          setUser(refreshed.user);
          syncFromUser(refreshed.user);
        }
      }
    }
  }, []);

  useEffect(() => {
    syncRealtimeAuth(session?.access_token ?? null);
  }, [session?.access_token]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      try {
        if (sessionUser) {
          await hydrateRolesFromProfile(sessionUser);
        } else {
          syncFromUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        syncRealtimeAuth(session?.access_token ?? null);
        setSession(session);
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);

        // Defer async Supabase calls — awaiting them inside this callback deadlocks
        // updateUser/setSession (see supabase-js auth state change docs).
        setTimeout(() => {
          void (async () => {
            try {
              if (sessionUser) {
                await hydrateRolesFromProfile(sessionUser);
              } else {
                syncFromUser(null);
              }
            } finally {
              setIsLoading(false);
            }
          })();
        }, 0);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [hydrateRolesFromProfile]);

  const setRole = async (
    newRole: UserRole,
    options?: { isSelfEmployed?: boolean }
  ) => {
    if (!user) {
      throw new Error('Not signed in');
    }

    const selfEmployed = options?.isSelfEmployed ?? isSelfEmployed;
    const nextRoles = rolesForPrimaryRole(newRole, selfEmployed);
    const rolePayload = {
      role: newRole,
      roles: nextRoles,
      ...(options?.isSelfEmployed !== undefined && {
        is_self_employed: options.isSelfEmployed,
      }),
      updated_at: new Date().toISOString(),
    };

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...rolePayload })
      .select('role, roles, is_self_employed')
      .single();

    if (profileError) {
      console.error('Error updating profile roles:', profileError);
      throw profileError;
    }

    if (profileRow) {
      syncFromProfileRow(profileRow);
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        role: newRole,
        roles: nextRoles,
        ...(options?.isSelfEmployed !== undefined && {
          is_self_employed: options.isSelfEmployed,
        }),
      },
    });

    if (error) {
      console.error('Error updating role:', error);
      throw error;
    }

    if (data.user) {
      setUser(data.user);
    }
  };

  const updateProfile = async (
    profileData: ProfileData,
    options?: { profileTableOnly?: boolean }
  ) => {
    if (!user) {
      throw new Error('Not signed in');
    }

    let roleFields: Pick<ProfileData, 'role' | 'roles'> = {};
    if (profileData.role && profileData.roles?.length) {
      roleFields = { role: profileData.role, roles: profileData.roles };
    } else if (profileData.is_self_employed !== undefined) {
      const selfEmployed = Boolean(profileData.is_self_employed);
      const primary =
        (profileData.role as UserRole | undefined) ??
        role ??
        primaryRoleFromRoles(roles);
      if (primary) {
        roleFields = {
          role: primary,
          roles: rolesForPrimaryRole(primary, selfEmployed),
        };
      }
    }

    const payload = { ...profileData, ...roleFields };
    const authMetadata = slimAuthMetadata(payload);

    suppressHydrateUntilRef.current = Date.now() + 4_000;

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .select('role, roles, is_self_employed')
      .single();

    if (profileError) {
      suppressHydrateUntilRef.current = 0;
      console.error('Error updating public profile:', profileError);
      throw profileError;
    }

    if (profileRow) {
      syncFromProfileRow(profileRow);
    } else if (roleFields.role && roleFields.roles) {
      syncFromProfileRow({
        role: roleFields.role,
        roles: roleFields.roles,
        is_self_employed: profileData.is_self_employed ?? null,
      });
    }

    if (options?.profileTableOnly) {
      suppressHydrateUntilRef.current = 0;
      return;
    }

    setUser({
      ...user,
      user_metadata: {
        ...user.user_metadata,
        ...authMetadata,
      },
    });

    void supabase.auth
      .updateUser({ data: authMetadata })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error updating auth metadata:', error);
          return;
        }
        if (data.user) {
          setUser(data.user);
        }
      })
      .finally(() => {
        suppressHydrateUntilRef.current = 0;
      });
  };

  const completeOnboarding = async (
    profileData: ProfileData,
    primaryRole: UserRole,
    isSelfEmployed: boolean
  ) => {
    if (!user) {
      throw new Error('Not signed in');
    }

    const nextRoles = rolesForPrimaryRole(primaryRole, isSelfEmployed);
    const payload = {
      ...profileData,
      role: primaryRole,
      roles: nextRoles,
      is_self_employed: isSelfEmployed,
    };
    const authMetadata = slimAuthMetadata(payload);

    suppressHydrateUntilRef.current = Date.now() + 4_000;

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .select('role, roles, is_self_employed')
      .single();

    if (profileError) {
      suppressHydrateUntilRef.current = 0;
      console.error('completeOnboarding profile:', profileError);
      throw profileError;
    }

    if (profileRow) {
      syncFromProfileRow(profileRow);
    }

    setUser({
      ...user,
      user_metadata: {
        ...user.user_metadata,
        ...authMetadata,
      },
    });

    void supabase.auth
      .updateUser({ data: authMetadata })
      .then(({ data, error }) => {
        if (error) {
          console.error('completeOnboarding auth sync:', error);
          return;
        }
        if (data.user) {
          setUser(data.user);
        }
      })
      .finally(() => {
        suppressHydrateUntilRef.current = 0;
      });
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role,
        roles,
        hasRole: (r) => checkRole(roles, r),
        isLoading,
        setRole,
        updateProfile,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
