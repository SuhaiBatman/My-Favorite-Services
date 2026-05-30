import {
  listProviderUpcomingAppointments,
  listUserUpcomingAppointments,
  type Appointment,
} from './appointments';
import { listFavorites, type FavoriteProvider } from './favorites';

export type UserHomeData = {
  appointments: Appointment[];
  favorites: FavoriteProvider[];
};

export type EmployeeHomeData = {
  asProvider: Appointment[];
  asClient: Appointment[];
  favorites: FavoriteProvider[];
};

export async function loadUserHomeData(userId: string): Promise<UserHomeData> {
  const [apptsRes, favsRes] = await Promise.allSettled([
    listUserUpcomingAppointments(userId),
    listFavorites(userId),
  ]);

  if (apptsRes.status === 'rejected') {
    console.error('loadUserHomeData appointments:', apptsRes.reason);
  }
  if (favsRes.status === 'rejected') {
    console.error('loadUserHomeData favorites:', favsRes.reason);
  }

  return {
    appointments: apptsRes.status === 'fulfilled' ? apptsRes.value : [],
    favorites: favsRes.status === 'fulfilled' ? favsRes.value : [],
  };
}

export async function loadEmployeeHomeData(userId: string): Promise<EmployeeHomeData> {
  const [providerRes, clientRes, favsRes] = await Promise.allSettled([
    listProviderUpcomingAppointments(userId),
    listUserUpcomingAppointments(userId),
    listFavorites(userId),
  ]);

  if (providerRes.status === 'rejected') {
    console.error('loadEmployeeHomeData provider:', providerRes.reason);
  }
  if (clientRes.status === 'rejected') {
    console.error('loadEmployeeHomeData client:', clientRes.reason);
  }
  if (favsRes.status === 'rejected') {
    console.error('loadEmployeeHomeData favorites:', favsRes.reason);
  }

  return {
    asProvider: providerRes.status === 'fulfilled' ? providerRes.value : [],
    asClient: clientRes.status === 'fulfilled' ? clientRes.value : [],
    favorites: favsRes.status === 'fulfilled' ? favsRes.value : [],
  };
}
