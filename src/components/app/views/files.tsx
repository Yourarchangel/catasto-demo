"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, FolderLock, Lock, Share2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { FileItem, FolderId, PersonId, ProId } from "@/lib/demo/types";
import { logFile, requestAttorneyShare, uploadFile, useHousehold } from "@/lib/demo/store";
import { ALL_FOLDERS, FOLDERS, PEOPLE } from "@/lib/demo/seed";
import { RULE, canSeeFile, heldFiles, isActive, isClient, visibleFiles } from "@/lib/demo/rules";
import { getFile, putFile } from "@/lib/demo/files";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Empty, FileLock, IconTile, PageHeader, RuleLine, VisibleTo, timeAgo } from "../bits";
import { useUi } from "../ui-state";
import { cn } from "@/lib/utils";

export function foldersFor(s: ReturnType<typeof useHousehold>, p: PersonId): FolderId[] {
  return isClient(p) ? ALL_FOLDERS : s.members[p as ProId].folders;
}

async function pdfFromLines(title: string, lines: string[]) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawText(title, { x: 56, y: 720, size: 15, font: bold });
  lines.forEach((l, i) => page.drawText(l, { x: 56, y: 690 - i * 20, size: 11, font }));
  page.drawText("Fictional demo document. Shared through Catasto.", { x: 56, y: 56, size: 9, font });
  return new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
}

export async function downloadFile(f: FileItem, me: PersonId) {
  const blob = f.blobKey ? await getFile(f.blobKey) : await pdfFromLines(f.name.replace(/\.pdf$/i, ""), f.preview ?? []);
  if (!blob) return toast.error("This file is no longer in this browser.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  logFile(me, f.id, "download");
}

export function FileViewer({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const { me } = useUi();
  const [url, setUrl] = useState<string>();
  const logged = useRef(false);
  useEffect(() => {
    if (!logged.current) {
      logged.current = true;
      logFile(me, file.id, "view");
    }
    let u: string | undefined;
    if (file.blobKey)
      getFile(file.blobKey).then((b) => {
        if (b) {
          u = URL.createObjectURL(b);
          setUrl(u);
        }
      });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [file, me]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{file.name}</DialogTitle>
          <DialogDescription>
            {PEOPLE[file.uploadedBy].name} uploaded it {timeAgo(file.at)}. This view is in the activity log.
          </DialogDescription>
        </DialogHeader>
        <VisibleTo file={file} />
        {file.preview ? (
          <div className="rounded-lg border bg-card p-6 font-serif shadow-sm">
            <p className="text-lg font-semibold">{file.preview[0]}</p>
            <div className="mt-3 space-y-1.5 border-t pt-3 text-[0.95rem]">
              {file.preview.slice(1).map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          </div>
        ) : url && file.mime?.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.name} className="max-h-[60vh] w-full rounded-lg border object-contain" />
        ) : url && file.mime === "application/pdf" ? (
          <iframe src={url} title={file.name} className="h-[60vh] w-full rounded-lg border" />
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No preview for this kind of file. Download it to open it.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => downloadFile(file, me)}>
            <Download aria-hidden /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UploadDialog({ onClose, onDone }: { onClose: () => void; onDone?: (fileId: string) => void }) {
  const s = useHousehold();
  const { me } = useUi();
  const folders = foldersFor(s, me);
  const [folder, setFolder] = useState<FolderId>(me === "gary" ? "tax" : me === "rebecca" ? "estate" : folders[0] ?? "tax");
  const [file, setFile] = useState<File | null>(null);
  const willHold = me === "gary" && folder === "tax" && (["elena", "rebecca"] as ProId[]).some((p) => s.members[p].status === "approved" && s.members[p].folders.includes("tax"));
  const submit = async () => {
    if (!file) return;
    const key = `up-${Date.now()}`;
    await putFile(key, file);
    const kb = file.size / 1024;
    const id = uploadFile(me, { name: file.name, folder, size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`, blobKey: key, mime: file.type });
    toast.success("Uploaded", { description: willHold ? "Held until both clients sign the 7216 form." : me === "rebecca" ? "Private to you and the clients." : "Everyone with access was notified." });
    onDone?.(id);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a file</DialogTitle>
          <DialogDescription>It goes into one folder. The clients decide who sees each folder.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="up-file">File</Label>
            <input id="up-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1" />
          </div>
          <div className="space-y-1.5">
            <Label>Folder</Label>
            <Select value={folder} onValueChange={(v) => setFolder(v as FolderId)}>
              <SelectTrigger aria-label="Folder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FOLDERS.find((x) => x.id === f)?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {willHold && <RuleLine text={RULE["7216"].line} />}
          {me === "rebecca" && <RuleLine text={RULE.rule16.line} />}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!file}>
            <Upload aria-hidden /> Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const s = useHousehold();
  const options = (["elena", "gary"] as ProId[]).filter((p) => s.members[p].status === "approved" && !file.sharedWith.includes(p));
  const [pick, setPick] = useState<ProId[]>(options.slice(0, 1));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share with the team?</DialogTitle>
          <DialogDescription>Sharing an attorney&apos;s document can waive attorney-client privilege. The clients must approve first.</DialogDescription>
        </DialogHeader>
        <RuleLine text={RULE.rule16.line} />
        <div className="space-y-2">
          {options.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <Checkbox checked={pick.includes(p)} onCheckedChange={(c) => setPick((x) => (c ? [...x, p] : x.filter((y) => y !== p)))} />
              {PEOPLE[p].name}, {PEOPLE[p].title}
            </label>
          ))}
          {options.length === 0 && <p className="text-sm text-muted-foreground">Nobody else is on the team yet.</p>}
        </div>
        <DialogFooter>
          <Button
            disabled={!pick.length}
            onClick={() => {
              requestAttorneyShare(file.id, pick);
              toast.success("Sent to the clients for approval");
              onClose();
            }}
          >
            Ask the clients to approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FileRow({ f, compact }: { f: FileItem; compact?: boolean }) {
  const s = useHousehold();
  const { me, go } = useUi();
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState(false);
  const ok = canSeeFile(s, me, f);
  const attorneyPrivate = f.uploadedBy === "rebecca" && f.sharedWith.length === 0;
  const pendingShare = s.consents.some((c) => c.fileId === f.id && c.status === "pending");
  return (
    <li className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-4 @2xl:grid-cols-[auto_minmax(0,1fr)_auto] @2xl:items-center", !ok && "bg-secondary/40")}>
      <IconTile icon={ok ? (f.hold ? FolderLock : FileText) : Lock} tone={ok ? (f.hold ? "dark" : "light") : "dark"} />
      <div className="min-w-0 space-y-1.5">
        <p className="line-clamp-2 font-medium leading-snug [overflow-wrap:anywhere]">{f.name}</p>
        <p className="text-[0.8rem] text-muted-foreground">
          {FOLDERS.find((x) => x.id === f.folder)?.name} · {PEOPLE[f.uploadedBy].first} · {timeAgo(f.at)} · {f.size}
        </p>
        {ok ? (
          <>
            {!compact && <VisibleTo file={f} />}
            {f.hold && <RuleLine text={RULE[f.hold.rule].line} />}
            {attorneyPrivate && !compact && <RuleLine text={RULE.rule16.line} />}
          </>
        ) : (
          <FileLock file={f} />
        )}
      </div>
      {ok && (
        <div className="col-span-2 flex flex-wrap items-center gap-2 @2xl:col-span-1 @2xl:justify-end">
          {isClient(me) && pendingShare && (
            <Button size="sm" className="flex-1 @2xl:flex-none" onClick={() => go("consent")}>
              Review and sign
            </Button>
          )}
          <Button size="sm" variant="outline" className={cn(isClient(me) && pendingShare ? "" : "flex-1 @2xl:flex-none")} onClick={() => setOpen(true)}>
            <Eye aria-hidden /> View
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadFile(f, me)} aria-label={`Download ${f.name}`}>
            <Download aria-hidden />
          </Button>
          {me === "rebecca" && f.uploadedBy === "rebecca" && !pendingShare && (["elena", "gary"] as ProId[]).some((p) => s.members[p].status === "approved" && !f.sharedWith.includes(p)) && (
            <Button size="sm" variant="outline" onClick={() => setShare(true)}>
              <Share2 aria-hidden /> Share
            </Button>
          )}
        </div>
      )}
      {open && <FileViewer file={f} onClose={() => setOpen(false)} />}
      {share && <ShareDialog file={f} onClose={() => setShare(false)} />}
    </li>
  );
}

export function NotYet() {
  return (
    <div className="panel p-6">
      <p className="font-medium">Nothing to show yet.</p>
      <RuleLine className="mt-2" text={RULE.regsp.line} />
    </div>
  );
}

export function FilesView() {
  const s = useHousehold();
  const { me, ui, set } = useUi();
  const [up, setUp] = useState(false);
  const active = isActive(s, me);
  const mine = foldersFor(s, me);
  const folder = ui.folder ?? "all";
  const list = [...visibleFiles(s, me), ...heldFiles(s, me)].filter((f) => folder === "all" || f.folder === folder).sort((a, b) => (a.at < b.at ? 1 : -1));
  return (
    <div>
      <PageHeader
        eyebrow="File Sharing"
        title="Files"
        lead="Every file shows who can see it. The clients decide who sees each folder."
        actions={
          active && (
            <Button onClick={() => setUp(true)} data-tour="upload">
              <Upload aria-hidden /> Upload
            </Button>
          )
        }
      />
      {!active ? (
        <NotYet />
      ) : (
        <>
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] @lg:flex-wrap" role="tablist" aria-label="Folders">
            {(["all", ...ALL_FOLDERS] as const).map((f) => {
              const allowed = f === "all" || mine.includes(f);
              return (
                <button
                  key={f}
                  role="tab"
                  aria-selected={folder === f}
                  onClick={() => set({ folder: f })}
                  className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm", folder === f ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/30", !allowed && folder !== f && "text-muted-foreground")}
                >
                  {!allowed && <Lock className="size-3" aria-label="No access" />}
                  {f === "all" ? "All" : FOLDERS.find((x) => x.id === f)?.name}
                </button>
              );
            })}
          </div>
          {folder !== "all" && !mine.includes(folder) && <RuleLine className="mb-4" text="The clients have not shared this folder with you." />}
          {list.length === 0 ? (
            <Empty icon={FileText} title="No files here yet">
              Upload one, or wait for the team to share.
            </Empty>
          ) : (
            <ul className="panel divide-y overflow-hidden" data-tour="file-list">
              {list.map((f) => (
                <FileRow key={f.id} f={f} />
              ))}
            </ul>
          )}
        </>
      )}
      {up && <UploadDialog onClose={() => setUp(false)} />}
    </div>
  );
}
