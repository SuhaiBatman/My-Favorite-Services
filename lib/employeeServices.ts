import { supabase } from './supabase';

export type EmployeeService = {
  id: string;
  employee_id: string;
  name: string;
};

export async function listEmployeeAvailability(employeeId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('employee_availability')
    .select('day_of_week')
    .eq('employee_id', employeeId);

  if (error) throw error;
  return (data ?? []).map((row) => row.day_of_week);
}

export async function listEmployeeServices(employeeId: string): Promise<EmployeeService[]> {
  const { data, error } = await supabase
    .from('employee_services')
    .select('id, employee_id, name')
    .eq('employee_id', employeeId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
