import ClientLayout from "@/components/ClientLayout";

export default function Home() {
  return (
    <main className="h-screen w-full relative overflow-hidden bg-[#f0f4f8] text-gray-800 flex flex-col">
      {/* Background Decorator */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--venturo-teal)]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[var(--venturo-teal)]/10 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="w-full relative z-10 h-full flex flex-col">
        <ClientLayout />
      </div>
    </main>
  );
}
