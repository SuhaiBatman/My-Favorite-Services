create policy "Users can delete own read notifications"
  on public.notifications for delete
  using (auth.uid() = user_id and read_at is not null);

grant delete on public.notifications to authenticated;
