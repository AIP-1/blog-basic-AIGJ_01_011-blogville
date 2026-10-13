import { AdminTabs } from "@/components/admin/AdminTabs";
import { requireAdmin } from "@/server/dal";

// 관리자 화면 묶음: 관리자가 아니면 404 (화면마다 다시 확인한다)
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <AdminTabs />
      {children}
    </div>
  );
}
