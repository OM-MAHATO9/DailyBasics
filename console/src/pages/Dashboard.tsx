import { api, inr } from "../api";
import { ErrorBox, Loading, useLoad } from "../ui";

export default function Dashboard() {
  const { data: s, error, loading, reload } = useLoad(() => api("/api/admin/stats"));

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>How the store is doing. Cancelled orders aren't counted in revenue.</p></div>
        <button className="btn" onClick={() => reload()}>Refresh</button>
      </div>
      {error && <ErrorBox error={error} retry={() => reload()} />}
      {loading && !s ? <Loading /> : s && (
        <>
          <div className="stats">
            <Stat label="Today" value={inr(s.today_revenue)} sub={`${s.today_orders} orders`} />
            <Stat label="Last 7 days" value={inr(s.week_revenue)} sub={`${s.week_orders} orders`} />
            <Stat label="Last 30 days" value={inr(s.month_revenue)} sub={`${s.month_orders} orders`} />
            <Stat label="Orders in progress" value={s.pending_orders} sub={<a href="#/orders">Open live orders →</a>} alert={s.pending_orders > 0} />
            <Stat label="Delivered" value={s.completed_orders} sub="all time" />
            <Stat label="Cancelled" value={s.cancelled_orders} sub="all time" />
            <Stat label="Customers" value={s.total_customers} />
            <Stat label="Active riders" value={s.active_partners} sub={<a href="#/riders">Manage riders →</a>} />
            <Stat label="Low stock (≤5)" value={s.low_stock_products} sub={<a href="#/menu">Check menu →</a>} alert={s.low_stock_products > 0} />
          </div>
          <div className="card">
            <div className="card-pad" style={{ paddingBottom: 0 }}><h3>Top-selling items</h3></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th></th><th>Item</th><th className="num">Price</th><th className="num">Sold</th></tr></thead>
                <tbody>
                  {(s.top_products || []).map((p: any) => (
                    <tr key={p.id}>
                      <td style={{ width: 56 }}>{p.image_url ? <img className="thumb" src={p.image_url} alt="" /> : <div className="thumb" />}</td>
                      <td className="strong">{p.name}</td>
                      <td className="num">{inr(p.price)}</td>
                      <td className="num">{p.sold_count || 0}</td>
                    </tr>
                  ))}
                  {!s.top_products?.length && <tr><td colSpan={4} className="empty">No sales yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value, sub, alert }: { label: string; value: any; sub?: any; alert?: boolean }) {
  return (
    <div className={`card stat ${alert ? "alert" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
