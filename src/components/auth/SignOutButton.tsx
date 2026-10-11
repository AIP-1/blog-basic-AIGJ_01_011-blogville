import { signOut } from "@/app/(auth)/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="btn btn-ghost text-ink-soft">
        로그아웃
      </button>
    </form>
  );
}
