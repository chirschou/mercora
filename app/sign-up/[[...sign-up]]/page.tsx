import { SignUp } from "@clerk/nextjs";
import { getStoreConfig } from "@/lib/store-config";

export function generateMetadata() {
  return { title: `Sign up - ${getStoreConfig().identity.name}` };
}

// 邀请链接的 __clerk_ticket 由 <SignUp /> 原生读取，页面不得改写查询串。
export default function SignUpPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface px-4 py-16 text-foreground">
      <SignUp />
    </div>
  );
}
