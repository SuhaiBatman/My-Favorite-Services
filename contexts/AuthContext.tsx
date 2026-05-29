import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  hasRole as checkRole,
  normalizeRoles,
  primaryRoleFromRoles,
  rolesForPrimaryRole,
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
  role?: string;
  roles?: string[];
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
  setRole: (role: UserRole) => Promise<void>;
  updateProfile: (data: ProfileData) => Promise<void>;
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
});

export const useAuth = () => useContext(AuthContext);

function applySessionUser(sessionUser: User | null) {
  const meta = sessionUser?.user_metadata ?? {};
  const roles = normalizeRoles(meta.role, meta.roles);
  const primary = primaryRoleFromRoles(roles);
  return { roles, primary };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [roles, setRolesState] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const syncFromUser = (sessionUser: User | null) => {
    const { roles: nextRoles, primary } = applySessionUser(sessionUser);
    setRolesState(nextRoles);
    setRoleState(primary);
  };

  const hydrateRolesFromProfile = async (sessionUser: User) => {
    const { data } = await supabase
      .from('profiles')
      .select('role, roles')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (!data) return;

    const fromDb = normalizeRoles(data.role, data.roles);
    const fromMeta = applySessionUser(sessionUser).roles;
    const metaMissingUser =
      fromDb.includes('employee') &&
      fromDb.includes('user') &&
      !fromMeta.includes('user');

    // Only backfill auth when metadata is empty or employee is missing the bundled
    // `user` role. Do not compare array lengths — that reverts intentional role switches
    // (e.g. business → employee) while the profile row is still stale.
    const metaEmpty = fromMeta.length === 0;

    if (fromDb.length && (metaEmpty || metaMissingUser)) {
      const primary = primaryRoleFromRoles(fromDb);
      if (primary) {
        await supabase.auth.updateUser({
          data: { role: primary, roles: fromDb },
        });
        const { data: refreshed } = await supabase.auth.getUser();
        if (refreshed.user) {
          setUser(refreshed.user);
          syncFromUser(refreshed.user);
        }
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      syncFromUser(session?.user ?? null);
      if (session?.user) await hydrateRolesFromProfile(session.user);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        syncFromUser(session?.user ?? null);
        if (session?.user) await hydrateRolesFromProfile(session.user);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setRole = async (newRole: UserRole) => {
    if (!user) return;

    const nextRoles = rolesForPrimaryRole(newRole);
    const rolePayload = {
      role: newRole,
      roles: nextRoles,
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .update(rolePayload)
      .eq('id', user.id);

    if (profileError) {
      console.error('Error updating profile roles:', profileError);
      return;
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { role: newRole, roles: nextRoles },
    });

    if (!error && data.user) {
      setUser(data.user);
      syncFromUser(data.user);
    } else {
      console.error('Error updating role:', error);
    }
  };

  const updateProfile = async (profileData: ProfileData) => {
    if (!user) return;

    // 1. Update Auth Metadata (for easy access in session)
    const { data, error: authError } = await supabase.auth.updateUser({
      data: { ...profileData }
    });

    if (authError) {
      console.error('Error updating auth metadata:', authError);
      throw authError;
    }

    // 2. Update Public Profiles Table (for querying and relational data)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...profileData,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Error updating public profile:', profileError);
      // We don't necessarily want to throw here if auth metadata succeeded, 
      // but it's good to know.
    }

    if (data.user) {
      setUser(data.user);
    }
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
