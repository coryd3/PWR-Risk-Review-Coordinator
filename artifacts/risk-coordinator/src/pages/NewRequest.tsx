import { RequestForm } from "@/components/RequestForm";
import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";

export default function NewRequest() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <Link href="/">
          <div className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 cursor-pointer">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </div>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">New Risk Review Request</h1>
        <p className="text-muted-foreground mt-1">Intake a new opportunity for risk review.</p>
      </div>

      <RequestForm />
    </div>
  );
}