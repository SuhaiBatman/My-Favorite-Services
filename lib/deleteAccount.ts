import { supabase } from './supabase';

export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    throw new Error(error.message);
  }

  await supabase.auth.signOut();
}
