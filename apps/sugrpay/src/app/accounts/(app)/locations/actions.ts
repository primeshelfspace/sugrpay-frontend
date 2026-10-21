'use server';

import { revalidatePath } from 'next/cache';
import { createLocation, updateLocation } from '@/accounts/lib/api';

export async function createLocationAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const kind = formData.get('kind') === 'WAREHOUSE' ? 'WAREHOUSE' : 'STORE';
  const brandId = String(formData.get('brandId') ?? '') || null;
  if (!name) return;
  await createLocation({ name, kind, brandId });
  revalidatePath('/accounts/locations');
}

export async function setLocationStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const status = formData.get('status') === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
  if (!id) return;
  await updateLocation(id, { status });
  revalidatePath('/accounts/locations');
}
