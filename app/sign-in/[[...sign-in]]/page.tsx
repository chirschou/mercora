import { SignIn } from "@clerk/nextjs";
import { getStoreConfig } from "@/lib/store-config";

export function generateMetadata() {
  return { title: `Sign in - ${getStoreConfig().identity.name}` };
}

// 不传 forceRedirectUrl：调用点给的 redirect_url 查询参数须保持生效。
export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface px-4 py-16 text-foreground">
      <SignIn />
    </div>
  );
}
