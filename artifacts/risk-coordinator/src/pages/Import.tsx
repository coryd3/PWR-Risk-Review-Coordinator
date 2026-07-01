import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useImportTracker,
  type ImportSummary,
  type ImportOutcome,
} from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  FileSpreadsheet,
  X,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

const ACCEPTED = ".xlsx,.xls,.csv";

function resultBadge(result: ImportOutcome["result"]) {
  switch (result) {
    case "imported":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Imported</Badge>;
    case "skipped":
      return <Badge variant="outline">Skipped</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
  }
}

function SummaryView({ summary }: { summary: ImportSummary }) {
  const stats = [
    { label: "Rows read", value: summary.rowsRead },
    {
      label: summary.dryRun ? "Would import" : "Imported",
      value: summary.imported,
      tone: "text-emerald-600",
    },
    { label: "Skipped", value: summary.skipped, tone: "text-amber-600" },
    { label: "Errors", value: summary.errored, tone: "text-destructive" },
  ];

  const errorRows = summary.outcomes.filter((o) => o.result === "error");
  const warningRows = summary.outcomes.filter(
    (o) => o.result === "imported" && (o.warnings?.length ?? 0) > 0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {summary.dryRun ? "Preview" : "Import"} results
          {summary.dryRun && (
            <Badge variant="outline" className="uppercase text-[10px]">
              Dry run — nothing saved
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{summary.sourceFile}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border p-4">
              <div className={`text-2xl font-bold ${s.tone ?? "text-foreground"}`}>
                {s.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {errorRows.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              {errorRows.length} row{errorRows.length === 1 ? "" : "s"} need
              fixing before {summary.dryRun ? "import" : "re-import"}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              These rows were not imported. Fix them in the source spreadsheet
              and upload again.
            </p>
            <div className="border rounded-lg divide-y bg-background max-h-[280px] overflow-y-auto">
              {errorRows.map((o) => (
                <OutcomeRow key={o.rowNumber} outcome={o} />
              ))}
            </div>
          </div>
        )}

        {warningRows.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 text-amber-700 dark:text-amber-500">
              <AlertTriangle className="w-4 h-4" />
              {warningRows.length} imported row
              {warningRows.length === 1 ? "" : "s"} to double-check
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              These rows were imported, but something is worth reviewing.
            </p>
            <div className="border rounded-lg divide-y bg-background max-h-[280px] overflow-y-auto">
              {warningRows.map((o) => (
                <OutcomeRow key={o.rowNumber} outcome={o} />
              ))}
            </div>
          </div>
        )}

        {summary.outcomes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">All rows</h3>
            <div className="border rounded-lg divide-y max-h-[420px] overflow-y-auto">
              {summary.outcomes.map((o) => (
                <OutcomeRow key={o.rowNumber} outcome={o} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OutcomeRow({ outcome: o }: { outcome: ImportOutcome }) {
  return (
    <div className="p-3 text-sm flex items-start gap-3">
      <span className="text-xs text-muted-foreground font-mono pt-0.5 w-12 shrink-0">
        Row {o.rowNumber}
      </span>
      <div className="shrink-0">{resultBadge(o.result)}</div>
      <div className="min-w-0">
        <div className="font-medium truncate">{o.label}</div>
        {o.reason && (
          <div className="text-xs text-muted-foreground mt-0.5">{o.reason}</div>
        )}
        {o.warnings && o.warnings.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {o.warnings.map((w: string, i: number) => (
              <li
                key={i}
                className="text-xs text-amber-700 dark:text-amber-500 flex items-start gap-1.5"
              >
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Import() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const importMutation = useImportTracker();
  const pending = importMutation.isPending;

  const runImport = (dryRun: boolean) => {
    if (!file) return;
    setSummary(null);
    importMutation.mutate(
      { data: { file }, params: { dryRun } },
      {
        onSuccess: (result) => {
          setSummary(result);
          if (!dryRun) {
            // Imported requests change dashboards and lists everywhere.
            queryClient.invalidateQueries();
            toast({
              title: "Import complete",
              description: `${result.imported} imported, ${result.skipped} skipped, ${result.errored} error(s).`,
            });
          } else {
            toast({
              title: "Preview ready",
              description: `${result.imported} row(s) would be imported.`,
            });
          }
        },
        onError: (err) => {
          toast({
            title: "Import failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Import Legacy Tracker
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload the old risk-review tracker spreadsheet to migrate historical
          reviews. Preview first to check the results, then import to save.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload spreadsheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setSummary(null);
            }}
          />

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-center hover:border-primary/60 hover:bg-accent/40 transition-colors"
            >
              <UploadCloud className="w-10 h-10 text-muted-foreground" />
              <div>
                <div className="font-medium">Choose a file to upload</div>
                <div className="text-sm text-muted-foreground">
                  Accepts .xlsx, .xls, or .csv
                </div>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3 border rounded-lg p-4">
              <FileSpreadsheet className="w-8 h-8 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              {!pending && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFile(null);
                    setSummary(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={!file || pending}
              onClick={() => runImport(true)}
            >
              {pending && <Spinner className="mr-2" />}
              Preview (dry run)
            </Button>
            <Button disabled={!file || pending} onClick={() => runImport(false)}>
              {pending && <Spinner className="mr-2" />}
              Import
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A dry run reports what would happen without saving anything. Imports
            are idempotent — re-uploading the same file won't create duplicates.
          </p>
        </CardContent>
      </Card>

      {summary && <SummaryView summary={summary} />}
    </div>
  );
}
