import { Container } from "@/components/shared/container";

// Sign In / Create Account shell (designs/screens/web/Sign_In.png): a centered
// card. Full width with gutters on mobile; fixed card width from tablet up.
// Pages (sign-in, sign-up) are not built yet.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center bg-muted py-section">
      <Container className="flex justify-center">
        <div className="w-full rounded-lg bg-card p-6 shadow-dropdown tablet:max-w-md">{children}</div>
      </Container>
    </main>
  );
}
