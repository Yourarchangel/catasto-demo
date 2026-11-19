"use client";
import { useRef, useState } from "react";
import { Eye, FileText, FolderPlus, Lock, Upload } from "lucide-react";
import type { FileItem, Folder, Household, Role } from "@/lib/core/types";
import { ROLE_LABEL, ROLES } from "@/lib/core/types";
import { createFolder, requestAccess, upload, viewFile } from "@/lib/core/api";
import { canUpload, canView, consentSigned, isJoined, pendingFor } from "@/lib/core/rules";
import { SAMPLES, sampleById } from "@/lib/core/samples";
import { Btn, Field, Modal, Pill } from "./ui";
import { cn } from "@/lib/utils";

const ORDER = (me: Role) => [me, ...ROLES.filter((r) => r !== me)];

export function FilesTab({ h, me }: { h: Household; me: Role }) {
  return (
    <div className="space-y-8">
      {ORDER(me).map((owner) => (
        <Workspace key={owner} h={h} me={me} owner={owner} />
      ))}
    </div>
  );
}

function Workspace({ h, me, owner }: { h: Household; me: Role; owner: Role }) {
  const [newFolder, setNewFolder] = useState(false);
  const folders = h.folders.filter((f) => f.owner === owner);
  const mine = owner === me;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3 border-b pb-2">
        <h2 className="flex items-center gap-2 text-[1.05rem] font-semibold">
          {ROLE_LABEL[owner]} workspace {mine && <Pill solid>You</Pill>}
        </h2>
        {mine && (
          <Btn size="sm" variant="outline" onClick={() => setNewFolder(true)}>
            <FolderPlus className="size-3.5" aria-hidden /> New folder
          </Btn>
        )}
      </div>
      {!isJoined(h, owner) ? (
        <p className="text-sm text-muted-foreground">The {ROLE_LABEL[owner]} hasn&apos;t joined yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {folders.map((f) => (
            <FolderCard key={f.id} h={h} me={me} f={f} />
          ))}
        </div>
      )}
      {newFolder && <NewFolder h={h} me={me} onClose={() => setNewFolder(false)} />}
    </section>
  );
}

function sharedLine(h: Household, f: Folder, me: Role) {
  const pros = h.consent?.sweeping ? ROLES.filter((r) => r !== "client" && isJoined(h, r)) : f.grants;
  const who = [...new Set<Role>([f.owner, "client", ...pros])];
  return "Can see it: " + who.map((r) => (r === me ? "You" : ROLE_LABEL[r])).join(", ");
}

function FolderCard({ h, me, f }: { h: Household; me: Role; f: Folder }) {
  const [up, setUp] = useState(false);
  const [open, setOpen] = useState<FileItem>();
  const ok = canView(h, me, f);
  const files = h.files.filter((x) => x.folderId === f.id);
  if (!ok) {
    const asked = pendingFor(h, f.id, me);
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{f.name}</p>
          <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
            {!consentSigned(h) ? "Locked until the client signs the information sharing consent." : "Locked. The client decides who sees this folder."}
          </p>
        </div>
        {consentSigned(h) && (
          <Btn size="sm" variant="outline" disabled={asked} onClick={() => requestAccess(h.id, me, f.id, me)}>
            {asked ? "Requested" : "Request access"}
          </Btn>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{f.name}</p>
          <p className="mt-0.5 text-[0.78rem] text-muted-foreground">{me === "client" || f.owner === me ? sharedLine(h, f, me) : `From the ${ROLE_LABEL[f.owner]}. View only.`}</p>
        </div>
        {canUpload(h, me, f) && (
          <Btn size="sm" onClick={() => setUp(true)}>
            <Upload className="size-3.5" aria-hidden /> Upload
          </Btn>
        )}
      </div>
      <ul className="mt-3 divide-y border-t">
        {files.length === 0 && <li className="py-3 text-[0.8rem] text-muted-foreground">No files yet.</li>}
        {files.map((x) => (
          <li key={x.id}>
            <button onClick={() => viewFile(h.id, me, x.id) && setOpen(x)} className="flex w-full items-center gap-2.5 py-2.5 text-left text-sm hover:underline">
              <FileText className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{x.name}</span>
              <span className="shrink-0 text-[0.75rem] text-muted-foreground">{x.size}</span>
            </button>
          </li>
        ))}
      </ul>
      {up && <UploadDialog h={h} me={me} f={f} onClose={() => setUp(false)} />}
      {open && <Viewer file={open} onClose={() => setOpen(undefined)} />}
    </div>
  );
}

function UploadDialog({ h, me, f, onClose }: { h: Household; me: Role; f: Folder; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const have = new Set(h.files.filter((x) => x.folderId === f.id).map((x) => x.sampleId));
  const list = [...SAMPLES.filter((s) => s.for === me), ...SAMPLES.filter((s) => s.for !== me)].filter((s) => !have.has(s.id));
  return (
    <Modal open onClose={onClose} title={`Upload to ${f.name}`} desc="Pick a sample document, or choose a file from your computer.">
      <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
        {list.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => {
                upload(h.id, me, f.id, { sampleId: s.id });
                onClose();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted"
            >
              <FileText className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{s.name}</span>
              <span className="text-[0.75rem] text-muted-foreground">{s.size}</span>
            </button>
          </li>
        ))}
      </ul>
      <input
        ref={input}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          upload(h.id, me, f.id, { name: file.name, size: file.size, url: URL.createObjectURL(file), mime: file.type });
          onClose();
        }}
      />
      <Btn variant="outline" onClick={() => input.current?.click()}>
        <Upload className="size-4" aria-hidden /> Choose from your computer
      </Btn>
      <p className="text-[0.75rem] text-muted-foreground">Demo only. Files stay in this browser tab. Don&apos;t upload real client documents.</p>
    </Modal>
  );
}

function NewFolder({ h, me, onClose }: { h: Household; me: Role; onClose: () => void }) {
  const [name, setName] = useState("");
  const [pick, setPick] = useState<Role[]>([]);
  const others = ROLES.filter((r) => r !== me && r !== "client");
  const sweeping = !!h.consent?.sweeping;
  return (
    <Modal open onClose={onClose} title="New folder" desc={`In your ${ROLE_LABEL[me]} workspace. Only you add files to it.`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          createFolder(h.id, me, name, pick);
          onClose();
        }}
      >
        <Field label="Folder name" value={name} onChange={setName} sample={me === "cpa" ? "Estimated payments" : me === "attorney" ? "Powers of attorney" : me === "client" ? "Insurance" : "Meeting notes"} autoFocus />
        {!sweeping && (
          <fieldset>
            <legend className="mb-2 text-[0.8rem] font-medium">Who else should see it?</legend>
            <div className="flex flex-wrap gap-2">
              {others.map((r) => (
                <label key={r} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm", pick.includes(r) ? "border-foreground" : "border-strong")}>
                  <input type="checkbox" className="accent-black" checked={pick.includes(r)} onChange={(e) => setPick((p) => (e.target.checked ? [...p, r] : p.filter((x) => x !== r)))} />
                  {ROLE_LABEL[r]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <p className="text-[0.8rem] text-muted-foreground">
          {me === "client" ? "They'll see it right away." : sweeping ? "The client lets the team see each other's folders, so everyone can see it." : "The client always sees it. Anyone else waits for the client to approve."}
        </p>
        <Btn className="w-full" disabled={!name}>
          Create folder
        </Btn>
      </form>
    </Modal>
  );
}

function Viewer({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const s = sampleById(file.sampleId);
  return (
    <Modal open onClose={onClose} title={file.name} desc={`Uploaded by the ${ROLE_LABEL[file.uploadedBy]}. Opened through a 5-minute link. This view is logged.`} wide>
      {s ? (
        <div className="rounded-md border bg-background p-8">
          <p className="mb-1 text-[0.7rem] uppercase tracking-widest text-muted-foreground">Sample document</p>
          {s.lines.map((l, i) => (
            <p key={i} className={cn(i === 0 ? "mb-4 font-display text-2xl" : "border-b py-2 text-sm")}>
              {l}
            </p>
          ))}
        </div>
      ) : file.url && file.mime?.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.url} alt={file.name} className="max-h-[60vh] w-full rounded-md border object-contain" />
      ) : file.url && file.mime === "application/pdf" ? (
        <iframe src={file.url} title={file.name} className="h-[60vh] w-full rounded-md border" />
      ) : (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          <Eye className="mx-auto mb-2 size-5" aria-hidden /> Preview isn&apos;t available for this file type.
        </div>
      )}
    </Modal>
  );
}
