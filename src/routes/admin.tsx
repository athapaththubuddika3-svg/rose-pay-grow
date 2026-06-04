import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";
import {
  adminLogin,
  adminMe,
  adminStats,
  adminListUsers,
  adminUpdateUser,
  adminUserActivity,
  adminListTasks,
  adminUpsertTask,
  adminDeleteTask,
  adminListSubmissions,
  adminReviewSubmission,
  adminListWithdrawals,
  adminReviewWithdraw,
  adminListCodes,
  adminUpsertCode,
  adminDeleteCode,
  adminGetSettings,
  adminSetSetting,
  adminBroadcast,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  ssr: false as any,
});

const TOKEN_KEY = "rpf_admin_token";

function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [ready, setReady] = useState(false);
  const me = useServerFn(adminMe);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      me({ data: { token: t } })
        .then(() => setToken(t))
        .catch(() => localStorage.removeItem(TOKEN_KEY))
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  if (!ready)
    return (
      <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Toaster position="top-right" theme="dark" richColors />
      {!token ? (
        <Login
          onLogin={(t) => {
            localStorage.setItem(TOKEN_KEY, t);
            setToken(t);
          }}
        />
      ) : (
        <Dashboard
          token={token}
          onLogout={() => {
            localStorage.removeItem(TOKEN_KEY);
            setToken("");
          }}
        />
      )}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const login = useServerFn(adminLogin);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-pink-950 via-slate-950 to-purple-950">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            const r = await login({ data: { email, password: pass } });
            onLogin(r.token);
            toast.success("Welcome");
          } catch (err: any) {
            toast.error(err.message);
          } finally {
            setLoading(false);
          }
        }}
        className="w-full max-w-sm bg-slate-900/80 backdrop-blur p-6 rounded-2xl border border-pink-500/30 space-y-4"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
            RosePayFi Admin
          </h1>
          <p className="text-xs text-slate-400 mt-1">Sign in to manage</p>
        </div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          className="w-full bg-slate-800 rounded-lg px-3 py-2 border border-slate-700 focus:border-pink-500 outline-none"
          required
        />
        <input
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          type="password"
          placeholder="Password"
          className="w-full bg-slate-800 rounded-lg px-3 py-2 border border-slate-700 focus:border-pink-500 outline-none"
          required
        />
        <button
          disabled={loading}
          className="w-full py-2 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 font-semibold disabled:opacity-50"
        >
          {loading ? "..." : "Sign in"}
        </button>
        <p className="text-[10px] text-slate-500 text-center">
          Default: admin@rosepayfi.com / RosePayFi2026!
        </p>
      </form>
    </div>
  );
}

type Tab =
  | "dashboard"
  | "users"
  | "tasks"
  | "submissions"
  | "withdrawals"
  | "codes"
  | "broadcast"
  | "settings";

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "users", label: "Users" },
    { id: "tasks", label: "Tasks" },
    { id: "submissions", label: "Submissions" },
    { id: "withdrawals", label: "Withdrawals" },
    { id: "codes", label: "Reward Codes" },
    { id: "broadcast", label: "Broadcast" },
    { id: "settings", label: "Settings" },
  ];
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <aside className="md:w-64 bg-slate-900 border-r border-slate-800 p-4">
        <div className="font-bold text-lg mb-4 bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
          🌹 RosePayFi
        </div>
        <nav className="space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${tab === t.id ? "bg-pink-500/20 text-pink-300" : "hover:bg-slate-800"}`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={onLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-slate-800 mt-4"
          >
            Logout
          </button>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        {tab === "dashboard" && <StatsView token={token} />}
        {tab === "users" && <UsersView token={token} />}
        {tab === "tasks" && <TasksView token={token} />}
        {tab === "submissions" && <SubmissionsView token={token} />}
        {tab === "withdrawals" && <WithdrawalsView token={token} />}
        {tab === "codes" && <CodesView token={token} />}
        {tab === "broadcast" && <BroadcastView token={token} />}
        {tab === "settings" && <SettingsView token={token} />}
      </main>
    </div>
  );
}

function StatsView({ token }: { token: string }) {
  const fn = useServerFn(adminStats);
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    fn({ data: { token } })
      .then(setS)
      .catch(() => {});
  }, [token]);
  if (!s) return <p>Loading...</p>;
  const cards = [
    ["Total Users", s.totalUsers],
    ["Pending Submissions", s.pendingTasks],
    ["Pending Withdrawals", s.pendingWithdrawals],
    ["Active Codes", s.activeCodes],
    ["Total Balance", `${s.sumBalance.toFixed(2)} ROSE`],
    ["Total Earned", `${s.sumEarned.toFixed(2)} ROSE`],
    ["Total Withdrawn", `${s.sumWithdraw.toFixed(2)} ROSE`],
  ];
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(([l, v]) => (
          <div key={l as string} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400">{l}</p>
            <p className="text-xl font-bold mt-1">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersView({ token }: { token: string }) {
  const list = useServerFn(adminListUsers);
  const upd = useServerFn(adminUpdateUser);
  const userActivity = useServerFn(adminUserActivity);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const reload = () =>
    list({ data: { token, search: search || undefined } }).then((r) => setUsers(r.users));
  useEffect(() => {
    reload();
  }, [token]);

  const openUser = async (user: any) => {
    setSelected(user);
    setActivity(null);
    const res = await userActivity({ data: { token, userId: user.id } });
    setActivity(res.activity);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Users ({users.length})</h2>
      <div className="flex gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username/telegram_id"
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-pink-500"
        />
        <button onClick={reload} className="px-4 py-2 bg-pink-500 rounded-lg">
          Search
        </button>
      </div>
      <div className="overflow-auto bg-slate-900 rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="text-left p-2">User</th>
              <th className="text-left p-2">TG ID</th>
              <th className="text-left p-2">Balance</th>
              <th className="text-left p-2">Earned</th>
              <th className="text-left p-2">Refs</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-800">
                <td className="p-2">
                  <button onClick={() => openUser(u)} className="text-left hover:text-pink-300">
                    @{u.username || u.first_name}
                  </button>
                </td>
                <td className="p-2 text-xs">{u.telegram_id}</td>
                <td className="p-2">{Number(u.balance).toFixed(2)}</td>
                <td className="p-2">{Number(u.total_earned).toFixed(2)}</td>
                <td className="p-2">{u.total_ref_count}</td>
                <td className="p-2">
                  {u.suspended ? (
                    <span className="text-red-400">Suspended</span>
                  ) : (
                    <span className="text-green-400">Active</span>
                  )}
                </td>
                <td className="p-2 flex gap-1">
                  <button
                    onClick={async () => {
                      try {
                        await upd({
                          data: {
                            token,
                            userId: u.id,
                            suspended: !u.suspended,
                            suspendReason: u.suspended ? null : "Manual",
                          },
                        });
                        toast.success(u.suspended ? "Unsuspended" : "Suspended");
                        reload();
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to update user");
                      }
                    }}
                    className={`px-2 py-1 rounded text-xs ${u.suspended ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}
                  >
                    {u.suspended ? "Unsuspend" : "Suspend"}
                  </button>
                  <button
                    onClick={async () => {
                      const v = prompt("New balance", String(u.balance));
                      if (v == null) return;
                      await upd({ data: { token, userId: u.id, balance: Number(v) } });
                      toast.success("Balance updated");
                      reload();
                    }}
                    className="px-2 py-1 rounded text-xs bg-slate-700"
                  >
                    Edit Balance
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/75 z-50 p-4 overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-w-3xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">@{selected.username || selected.first_name}</h3>
                <p className="text-xs text-slate-400">
                  TG: {selected.telegram_id} · IP: {selected.ip_address || "-"}
                </p>
                <p
                  className={`text-xs mt-1 ${selected.suspended ? "text-red-300" : "text-green-300"}`}
                >
                  {selected.suspended
                    ? `Suspended: ${selected.suspend_reason || "No reason"}`
                    : "Active"}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400">
                Close
              </button>
            </div>
            {!activity ? (
              <p className="text-sm text-slate-400">Loading activity…</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <Panel
                  title="Ad Watches"
                  items={activity.adWatches}
                  render={(item: any) =>
                    `${item.kind} · ${item.duration_sec}s · ${item.reward} ROSE`
                  }
                />
                <Panel
                  title="Ad Tasks"
                  items={activity.adTasks}
                  render={(item: any) =>
                    `${item.reward} ROSE · ${new Date(item.completed_at).toLocaleString()}`
                  }
                />
                <Panel
                  title="Tasks"
                  items={activity.tasks}
                  render={(item: any) => `${item.task?.title || "Task"} · ${item.status}`}
                />
                <Panel
                  title="Withdrawals"
                  items={activity.withdrawals}
                  render={(item: any) => `${item.amount} ROSE · ${item.status}`}
                />
                <Panel
                  title="Referrals"
                  items={activity.referrals}
                  render={(item: any) =>
                    `${item.status} · referrer ${item.referrer?.telegram_id || "-"} · referred ${item.referred?.telegram_id || "-"}`
                  }
                />
                <Panel
                  title="Reward Codes / Audits"
                  items={[...(activity.rewardCodes || []), ...(activity.balanceAudits || [])]}
                  render={(item: any) =>
                    item.code_id
                      ? `${item.reward_code?.code || "CODE"} · ${item.amount} ROSE`
                      : `Audit diff ${item.diff}`
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  items,
  render,
}: {
  title: string;
  items: any[];
  render: (item: any) => string;
}) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
      <h4 className="font-semibold mb-2">{title}</h4>
      <div className="space-y-2 max-h-64 overflow-auto">
        {items?.length ? (
          items.map((item, index) => (
            <div
              key={item.id || index}
              className="text-xs text-slate-300 border border-slate-800 rounded-lg p-2"
            >
              {render(item)}
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-500">No activity</p>
        )}
      </div>
    </div>
  );
}

function TasksView({ token }: { token: string }) {
  const list = useServerFn(adminListTasks);
  const upsert = useServerFn(adminUpsertTask);
  const del = useServerFn(adminDeleteTask);
  const [tasks, setTasks] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const reload = () => list({ data: { token } }).then((r) => setTasks(r.tasks));
  useEffect(() => {
    reload();
  }, [token]);
  const empty = {
    type: "main",
    title: "",
    description: "",
    amount: 0.1,
    channel_username: "",
    channel_url: "",
    sort_order: 0,
    active: true,
  };
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Tasks ({tasks.length})</h2>
        <button onClick={() => setEdit(empty)} className="px-4 py-2 bg-pink-500 rounded-lg">
          + New Task
        </button>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <div
            key={t.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3"
          >
            <span className="px-2 py-1 text-xs rounded bg-pink-500/20 text-pink-300">{t.type}</span>
            <div className="flex-1">
              <p className="font-semibold">{t.title}</p>
              <p className="text-xs text-slate-400">
                {t.amount} ROSE · {t.active ? "active" : "inactive"}
              </p>
            </div>
            <button onClick={() => setEdit(t)} className="px-3 py-1 text-xs bg-slate-700 rounded">
              Edit
            </button>
            <button
              onClick={async () => {
                if (!confirm("Delete?")) return;
                await del({ data: { token, id: t.id } });
                toast.success("Deleted");
                reload();
              }}
              className="px-3 py-1 text-xs bg-red-500/20 text-red-300 rounded"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {edit && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setEdit(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              await upsert({
                data: {
                  token,
                  ...edit,
                  amount: Number(edit.amount),
                  sort_order: Number(edit.sort_order),
                },
              });
              toast.success("Saved");
              setEdit(null);
              reload();
            }}
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-full max-w-md space-y-2 max-h-[90vh] overflow-auto"
          >
            <h3 className="font-bold">{edit.id ? "Edit Task" : "New Task"}</h3>
            <select
              value={edit.type}
              onChange={(e) => setEdit({ ...edit, type: e.target.value })}
              className="w-full bg-slate-800 rounded p-2"
            >
              <option value="main">Main</option>
              <option value="partner">Partner</option>
              <option value="other">Other</option>
            </select>
            <input
              value={edit.title}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              placeholder="Title"
              className="w-full bg-slate-800 rounded p-2"
              required
            />
            <textarea
              value={edit.description || ""}
              onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              placeholder="Description"
              className="w-full bg-slate-800 rounded p-2"
            />
            <input
              type="number"
              step="0.01"
              value={edit.amount}
              onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
              placeholder="Amount ROSE"
              className="w-full bg-slate-800 rounded p-2"
            />
            <input
              value={edit.channel_username || ""}
              onChange={(e) => setEdit({ ...edit, channel_username: e.target.value })}
              placeholder="Channel username (e.g. @channel)"
              className="w-full bg-slate-800 rounded p-2"
            />
            <input
              value={edit.channel_url || ""}
              onChange={(e) => setEdit({ ...edit, channel_url: e.target.value })}
              placeholder="Channel/Open URL"
              className="w-full bg-slate-800 rounded p-2"
            />
            <input
              type="number"
              value={edit.sort_order}
              onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })}
              placeholder="Sort order"
              className="w-full bg-slate-800 rounded p-2"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.active}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
              />{" "}
              Active
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="flex-1 py-2 bg-slate-700 rounded"
              >
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2 bg-pink-500 rounded">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SubmissionsView({ token }: { token: string }) {
  const list = useServerFn(adminListSubmissions);
  const review = useServerFn(adminReviewSubmission);
  const [items, setItems] = useState<any[]>([]);
  const reload = () => list({ data: { token } }).then((r) => setItems(r.items));
  useEffect(() => {
    reload();
  }, [token]);
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Pending Submissions ({items.length})</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {items.map((it) => (
          <div
            key={it.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2"
          >
            <p className="font-semibold">
              {it.task?.title}{" "}
              <span className="text-xs text-pink-300">+{it.task?.amount} ROSE</span>
            </p>
            <p className="text-xs text-slate-400">
              @{it.user?.username || it.user?.first_name} · TG: {it.user?.telegram_id}
            </p>
            {it.screenshot_url && (
              <a href={it.screenshot_url} target="_blank">
                <img
                  src={it.screenshot_url}
                  className="w-full max-h-48 object-contain rounded border border-slate-700"
                />
              </a>
            )}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await review({ data: { token, id: it.id, approve: true } });
                  toast.success("Approved");
                  reload();
                }}
                className="flex-1 py-1.5 bg-green-500/20 text-green-300 rounded text-sm"
              >
                Approve
              </button>
              <button
                onClick={async () => {
                  const r = prompt("Reject reason?", "Invalid");
                  if (!r) return;
                  await review({ data: { token, id: it.id, approve: false, reason: r } });
                  toast.success("Rejected");
                  reload();
                }}
                className="flex-1 py-1.5 bg-red-500/20 text-red-300 rounded text-sm"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-slate-500">No pending submissions</p>}
    </div>
  );
}

function WithdrawalsView({ token }: { token: string }) {
  const list = useServerFn(adminListWithdrawals);
  const review = useServerFn(adminReviewWithdraw);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [txInputs, setTxInputs] = useState<Record<string, string>>({});
  const reload = () => list({ data: { token, status: filter } }).then((r) => setItems(r.items));
  useEffect(() => {
    reload();
  }, [token, filter]);
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Withdrawals</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-slate-900 rounded px-3 py-1 border border-slate-700"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="space-y-2">
        {items.map((w) => (
          <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{w.amount} ROSE</p>
                <p className="text-xs text-slate-400">
                  @{w.user?.username || w.user?.first_name} · TG: {w.user?.telegram_id}
                </p>
                <p className="text-xs font-mono break-all text-slate-300 mt-1">
                  {w.wallet_address}
                </p>
                <p className="text-xs text-slate-500">
                  Refs: {w.user?.total_ref_count} · Total Withdrawn: {w.user?.total_withdraw}
                </p>
                {w.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={txInputs[w.id] ?? ""}
                      onChange={(e) => setTxInputs((prev) => ({ ...prev, [w.id]: e.target.value }))}
                      placeholder="Enter tx id"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-pink-500"
                    />
                  </div>
                )}
                {w.tx_id && <p className="text-xs text-green-400 mt-1">TX: {w.tx_id}</p>}
                {w.reject_reason && (
                  <p className="text-xs text-red-400 mt-1">Reason: {w.reject_reason}</p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded h-fit ${w.status === "pending" ? "bg-yellow-500/20 text-yellow-300" : w.status === "approved" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}
              >
                {w.status}
              </span>
            </div>
            {w.status === "pending" && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={async () => {
                    const tx = (txInputs[w.id] || "").trim();
                    if (!tx) return toast.error("Enter tx id first");
                    setApprovingId(w.id);
                    try {
                      await review({ data: { token, id: w.id, approve: true, txId: tx } });
                      toast.success("Approved & posted");
                      setTxInputs((prev) => ({ ...prev, [w.id]: "" }));
                      reload();
                    } catch (e: any) {
                      toast.error(e.message || "Approval failed");
                    } finally {
                      setApprovingId(null);
                    }
                  }}
                  disabled={approvingId === w.id}
                  className="flex-1 py-1.5 bg-green-500/20 text-green-300 rounded text-sm"
                >
                  {approvingId === w.id ? "Posting..." : "Approve & Pay"}
                </button>
                <button
                  onClick={async () => {
                    const r = prompt("Reject reason?");
                    if (!r) return;
                    await review({ data: { token, id: w.id, approve: false, reason: r } });
                    toast.success("Rejected");
                    reload();
                  }}
                  className="flex-1 py-1.5 bg-red-500/20 text-red-300 rounded text-sm"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-slate-500">None</p>}
      </div>
    </div>
  );
}

function CodesView({ token }: { token: string }) {
  const list = useServerFn(adminListCodes);
  const upsert = useServerFn(adminUpsertCode);
  const del = useServerFn(adminDeleteCode);
  const [codes, setCodes] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const reload = () => list({ data: { token } }).then((r) => setCodes(r.codes));
  useEffect(() => {
    reload();
  }, [token]);
  const empty = { code: "", amount: 0.5, max_uses: 100, active: true };
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Reward Codes</h2>
        <button onClick={() => setEdit(empty)} className="px-4 py-2 bg-pink-500 rounded-lg">
          + New Code
        </button>
      </div>
      <div className="space-y-2">
        {codes.map((c) => (
          <div
            key={c.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3"
          >
            <code className="font-mono text-pink-300 font-bold">{c.code}</code>
            <div className="flex-1 text-sm">
              <p>
                {c.amount} ROSE · {c.used_count}/{c.max_uses} used
              </p>
              <p className="text-xs text-slate-400">{c.active ? "active" : "inactive"}</p>
            </div>
            <button onClick={() => setEdit(c)} className="px-3 py-1 text-xs bg-slate-700 rounded">
              Edit
            </button>
            <button
              onClick={async () => {
                if (!confirm("Delete?")) return;
                await del({ data: { token, id: c.id } });
                toast.success("Deleted");
                reload();
              }}
              className="px-3 py-1 text-xs bg-red-500/20 text-red-300 rounded"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {edit && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setEdit(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              await upsert({
                data: {
                  token,
                  ...edit,
                  amount: Number(edit.amount),
                  max_uses: Number(edit.max_uses),
                },
              });
              toast.success("Saved");
              setEdit(null);
              reload();
            }}
            className="bg-slate-900 border border-slate-700 rounded-xl p-4 w-full max-w-md space-y-2"
          >
            <h3 className="font-bold">{edit.id ? "Edit Code" : "New Code"}</h3>
            <input
              value={edit.code}
              onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
              placeholder="CODE123"
              className="w-full bg-slate-800 rounded p-2"
              required
            />
            <input
              type="number"
              step="0.01"
              value={edit.amount}
              onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
              placeholder="Amount ROSE"
              className="w-full bg-slate-800 rounded p-2"
            />
            <input
              type="number"
              value={edit.max_uses}
              onChange={(e) => setEdit({ ...edit, max_uses: e.target.value })}
              placeholder="Max uses"
              className="w-full bg-slate-800 rounded p-2"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.active}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
              />{" "}
              Active
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="flex-1 py-2 bg-slate-700 rounded"
              >
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2 bg-pink-500 rounded">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function BroadcastView({ token }: { token: string }) {
  const broadcast = useServerFn(adminBroadcast);
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("Open RosePayFi");
  const [buttonUrl, setButtonUrl] = useState("https://t.me/RosePayFibot?startapp=open");
  const [toUsers, setToUsers] = useState(true);
  const [toChannel, setToChannel] = useState(true);
  const [sending, setSending] = useState(false);

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-2xl font-bold">Broadcast</h2>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="HTML message"
          className="w-full min-h-40 bg-slate-800 rounded-lg p-3 outline-none"
        />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          className="w-full bg-slate-800 rounded-lg p-3 outline-none"
        />
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="Button text"
            className="w-full bg-slate-800 rounded-lg p-3 outline-none"
          />
          <input
            value={buttonUrl}
            onChange={(e) => setButtonUrl(e.target.value)}
            placeholder="Button URL"
            className="w-full bg-slate-800 rounded-lg p-3 outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={toUsers} onChange={(e) => setToUsers(e.target.checked)} />
            All users
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={toChannel} onChange={(e) => setToChannel(e.target.checked)} />
            Telegram channel
          </label>
        </div>
        <button
          disabled={sending || !message.trim() || (!toUsers && !toChannel)}
          onClick={async () => {
            setSending(true);
            try {
              const res = await broadcast({
                data: {
                  token,
                  message,
                  imageUrl,
                  buttonText,
                  buttonUrl,
                  toUsers,
                  toChannel,
                },
              });
              toast.success(`Sent ${res.sent}, failed ${res.failed}`);
            } catch (e: any) {
              toast.error(e.message);
            } finally {
              setSending(false);
            }
          }}
          className="px-4 py-2 bg-pink-500 rounded-lg font-semibold disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send Broadcast"}
        </button>
      </div>
    </div>
  );
}

function SettingsView({ token }: { token: string }) {
  const get = useServerFn(adminGetSettings);
  const set = useServerFn(adminSetSetting);
  const [s, setS] = useState<Record<string, any>>({});
  const reload = () => get({ data: { token } }).then((r) => setS(r.settings));
  useEffect(() => {
    reload();
  }, [token]);
  const fields: [string, string, any][] = [
    ["min_withdraw", "Minimum Withdraw (ROSE)", 1],
    ["max_withdraw", "Maximum Withdraw (ROSE)", 10],
    ["withdraw_fee", "Withdraw Fee (ROSE)", 0.5],
    ["min_refs_for_withdraw", "Min Referrals for Withdraw", 2],
    ["min_daily_ads_for_withdraw", "Min Daily Ads for Withdraw", 10],
    ["ref_bonus", "Referral Bonus (ROSE)", 1],
    ["ref_commission_pct", "Referral Commission %", 10],
    ["daily_bonus_amount", "Daily Bonus (ROSE)", 0.05],
    ["ad_reward", "Ad Reward (ROSE)", 0.05],
    ["ad_daily_limit", "Daily Ad Limit", 40],
    ["ad_session_limit", "Session Ad Limit", 20],
    ["ad_session_hours", "Session Hours", 12],
    ["ad_min_watch_rew", "Min Watch Time Rewarded (sec)", 33],
    ["ad_task_reward", "Ad Task Reward (ROSE)", 0.02],
    ["ad_task_daily_limit", "Daily Ad Task Limit", 15],
    ["ad_task_cooldown_sec", "Ad Task Cooldown (sec)", 10],
    ["ad_block_rew", "Adsgram Rewarded Block ID", "30047"],
    ["ad_block_int", "Adsgram Auto Interstitial Block ID", "int-30048"],
    ["ad_task_block", "Adsgram Task Block ID", "task-30049"],
    ["ad_min_watch_task", "Min Watch Time Task (sec)", 33],
    ["rose_price_override", "ROSE Price Override (USD, 0 = auto)", 0],
    ["bot_username", "Bot Username", "RosePayFibot"],
    ["community_channel", "Community Channel", "@rosepayfi"],
    ["payment_channel", "Payment Channel", "@rosepayfipayment"],
  ];
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <div className="space-y-3 max-w-md">
        {fields.map(([k, label, def]) => (
          <div key={k as string} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <label className="text-xs text-slate-400">{label}</label>
            <div className="flex gap-2 mt-1">
              <input
                value={s[k as string] ?? def}
                onChange={(e) => setS({ ...s, [k as string]: e.target.value })}
                className="flex-1 bg-slate-800 rounded p-2"
              />
              <button
                onClick={async () => {
                  const v = s[k as string] ?? def;
                  const parsed = typeof def === "number" ? Number(v) : v;
                  await set({ data: { token, key: k as string, value: parsed } });
                  toast.success("Saved");
                  reload();
                }}
                className="px-3 bg-pink-500 rounded"
              >
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
