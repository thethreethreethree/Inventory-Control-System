import { api } from "../api/client";
import { useAsync } from "../lib/useAsync";
import { Badge, Card, EmptyRow, ErrorBanner, Loading, PageHeader, statusTone } from "../components/ui";

export function Items() {
  const { data, loading, error } = useAsync(() => api.items());
  return (
    <>
      <PageHeader title="Items" subtitle="The item master — what each thing is, not how much exists." />
      <ErrorBanner error={error} />
      <Card>
        {loading ? (
          <Loading />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Brand</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((i) => (
                <tr key={i.id}>
                  <td>{i.sku}</td>
                  <td>{i.name}</td>
                  <td>{i.brand ?? "—"}</td>
                  <td>{i.itemType}</td>
                  <td>
                    <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                  </td>
                </tr>
              ))}
              {data && data.length === 0 && <EmptyRow cols={5} />}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
