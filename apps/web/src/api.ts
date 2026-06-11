export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export type Health = { status: string; db: string; time: string };
export type Balance = {
  sku: string;
  item: string;
  location: string;
  unit: string;
  on_hand: string;
};
export type Item = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  itemType: string;
  status: string;
};
