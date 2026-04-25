"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookText,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  Rocket,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MilkdownEditorPane } from "@/components/blog/editor/milkdown-editor-pane";
import { CoverUpload } from "@/components/blog/cover-upload";
import { PostTagSelector } from "@/components/blog/post-tag-selector";
import { buildZcLoginUrl, useAuthToken, useCurrentUser } from "@/lib/auth";
import {
  createPost,
  discardDraft,
  getDraft,
  getPostBody,
  getPostById,
  publishDraft,
  saveDraft,
  setCacheKV,
  updatePostMeta,
  updateProjectState,
} from "@/lib/api";
import { getPostHref } from "@/lib/blog-links";
import { formatDate } from "@/lib/utils";
import type { BlogPost } from "@/lib/types";

type EditorPreference = {
  lastProjectId?: number | null;
};

type PublishedSnapshot = {
  post: BlogPost;
  body: string;
  liveHref: string | null;
};

export default function WritePage() {
  return (
    <React.Suspense fallback={<WriteLoading label="正在初始化写作工作台" />}>
      <WritePageInner />
    </React.Suspense>
  );
}

function WriteLoading({ label }: { label: string }) {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="flex items-center gap-3 rounded-xl bg-card p-8 ring-border">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}...</p>
      </div>
    </section>
  );
}

function WritePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready, isAuthed } = useAuthToken();
  const user = useCurrentUser();

  const requestedDraftId = React.useMemo(() => {
    const raw = searchParams.get("draft") || searchParams.get("projectId") || "";
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const [projectId, setProjectId] = React.useState<number | null>(requestedDraftId);
  const [publishedSnapshot, setPublishedSnapshot] = React.useState<PublishedSnapshot | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [editorSeed, setEditorSeed] = React.useState(0);
  const [immersiveMode, setImmersiveMode] = React.useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = React.useState(false);
  const [content, setContent] = React.useState("");
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [publishMessage, setPublishMessage] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [urlSlug, setUrlSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>([]);
  const [cover, setCover] = React.useState<string | null>(null);
  const [canonicalUrl, setCanonicalUrl] = React.useState("");
  const [seoTitle, setSeoTitle] = React.useState("");
  const [seoDescription, setSeoDescription] = React.useState("");
  const [seoKeywords, setSeoKeywords] = React.useState("");

  const cacheKey = React.useMemo(
    () => `usercachekv:blog:${user?.id ?? "anonymous"}:editor-preference`,
    [user?.id]
  );

  const wordCount = React.useMemo(() => {
    const text = content.trim();
    if (!text) return 0;
    const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const rest = text.replace(/[\u4e00-\u9fff]/g, " ").trim().split(/\s+/).filter(Boolean).length;
    return cjk + rest;
  }, [content]);

  const liveHref = publishedSnapshot?.liveHref ?? null;
  const hasPublishedVersion = publishedSnapshot?.post.state === "public";
  const canRestorePublished = Boolean(publishedSnapshot && (hasSavedDraft || dirty));

  const applyDraft = React.useCallback((id: number, draft: Awaited<ReturnType<typeof getDraft>>) => {
    if (!draft) return;
    setProjectId(id);
    setTitle(draft.title || "");
    setSummary(draft.description || "");
    setSlug(draft.slug || "");
    setUrlSlug(draft.slug || "");
    setSlugTouched(Boolean(draft.slug));
    setContent(draft.content || "");
    setCover(draft.cover || null);
    setTags(draft.tags || []);
    setDirty(false);
    setHasSavedDraft(true);
    setLastSavedAt(draft.savedAt || draft.updatedAt || new Date().toISOString());
    setEditorSeed((seed) => seed + 1);
  }, []);

  const applyPublishedSnapshot = React.useCallback((snapshot: PublishedSnapshot) => {
    const { post, body } = snapshot;
    setProjectId(post.id);
    setTitle(post.title || post.name || "");
    setSummary(post.summary || post.description || "");
    setSlug(post.blogConfig?.slug || "");
    setUrlSlug(post.blogConfig?.slug || post.name || "");
    setSlugTouched(Boolean(post.blogConfig?.slug));
    setContent(body || "");
    setCover(post.blogConfig?.cover || post.thumbnail || null);
    setTags((post.project_tags ?? []).map((tag) => tag.name));
    setCanonicalUrl("");
    setSeoTitle(post.blogConfig?.seo?.title || "");
    setSeoDescription(post.blogConfig?.seo?.description || "");
    setSeoKeywords(post.blogConfig?.seo?.keywords || "");
    setPublishMessage("");
    setDirty(false);
    setHasSavedDraft(false);
    setLastSavedAt(post.time || new Date().toISOString());
    setEditorSeed((seed) => seed + 1);
  }, []);

  const resetEditor = React.useCallback(() => {
    setProjectId(null);
    setPublishedSnapshot(null);
    setHasSavedDraft(false);
    setTitle("");
    setSummary("");
    setSlug("");
    setUrlSlug("");
    setSlugTouched(false);
    setContent("");
    setTags([]);
    setCover(null);
    setCanonicalUrl("");
    setSeoTitle("");
    setSeoDescription("");
    setSeoKeywords("");
    setPublishMessage("");
    setDirty(false);
    setLastSavedAt(null);
    setEditorSeed((seed) => seed + 1);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    if (!isAuthed || !token) {
      setLoading(false);
      return;
    }

    let canceled = false;

    async function bootstrap() {
      const authToken = token ?? undefined;
      setLoading(true);
      try {
        if (!requestedDraftId) {
          resetEditor();
          return;
        }

        const [draft, post] = await Promise.all([
          getDraft(requestedDraftId, authToken),
          getPostById(requestedDraftId),
        ]);

        let snapshot: PublishedSnapshot | null = null;
        if (post) {
          const body = post.file?.source || (await getPostBody(post));
          const href = post.state === "public" ? getPostHref(post) : "/posts";
          snapshot = { post, body: body || "", liveHref: href !== "/posts" ? href : null };
        }

        if (canceled) return;
        setPublishedSnapshot(snapshot);

        if (draft) {
          applyDraft(requestedDraftId, draft);
          return;
        }

        if (snapshot) {
          applyPublishedSnapshot(snapshot);
          return;
        }

        resetEditor();
        toast.error("文章加载失败");
      } catch {
        if (!canceled) {
          toast.error("初始化编辑器失败");
          resetEditor();
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      canceled = true;
    };
  }, [applyDraft, applyPublishedSnapshot, isAuthed, ready, requestedDraftId, resetEditor, token]);

  const isPageLoading = !ready || (isAuthed && loading);

  React.useEffect(() => {
    if (!ready || !isAuthed || !token) return;
    void setCacheKV(cacheKey, { lastProjectId: projectId ?? null } satisfies EditorPreference, token);
  }, [cacheKey, isAuthed, projectId, ready, token]);

  React.useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const ensureProject = React.useCallback(async () => {
    if (!token) throw new Error("未登录");
    if (projectId) return projectId;

    const created = await createPost({ title: title.trim() || "未命名文章", summary: summary.trim(), state: "draft" }, token);
    setProjectId(created.id);
    setUrlSlug(created.blogConfig?.slug || created.name || "");
    setHasSavedDraft(false);
    router.replace(`/write?draft=${created.id}`);
    return created.id;
  }, [projectId, router, summary, title, token]);

  const persistDraft = React.useCallback(async (silent = false) => {
    if (!token) throw new Error("未登录");

    setSaving(true);
    try {
      const id = await ensureProject();
      const normalizedTitle = title.trim() || "未命名文章";
      const normalizedSlug = slug.trim() || urlSlug || slugify(normalizedTitle);

      await saveDraft(id, {
        title: normalizedTitle,
        description: summary.trim(),
        content,
        slug: normalizedSlug || undefined,
        cover: cover || null,
        tags,
        updatedAt: new Date().toISOString(),
      }, token);

      await updatePostMeta(id, {
        title: normalizedTitle,
        summary: summary.trim(),
        slug: normalizedSlug || undefined,
        cover: cover || null,        seo: {
          title: seoTitle.trim() || undefined,
          description: seoDescription.trim() || undefined,
          keywords: seoKeywords.trim() || undefined,
        },
      }, token);

      const now = new Date().toISOString();
      setLastSavedAt(now);
      setDirty(false);
      setHasSavedDraft(true);
      if (!silent) toast.success("草稿已保存");
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "保存失败");
      throw error;
    } finally {
      setSaving(false);
    }
  }, [content, cover, ensureProject, seoDescription, seoKeywords, seoTitle, slug, summary, tags, title, token, urlSlug]);

  React.useEffect(() => {
    if (!ready || !isAuthed || !token || !dirty) return;
    const timer = window.setTimeout(() => { void persistDraft(true); }, 2400);
    return () => window.clearTimeout(timer);
  }, [dirty, isAuthed, persistDraft, ready, token]);

  const handleRestorePublished = React.useCallback(async () => {
    if (!publishedSnapshot) return;
    const ok = window.confirm(hasSavedDraft ? "确定要删除当前草稿并恢复为上线版本吗？已上线文章本身不会受影响。" : "确定要恢复为上线版本吗？当前未保存的编辑内容将被丢弃。");
    if (!ok) return;
    try {
      if (hasSavedDraft && token && projectId) {
        await discardDraft(projectId, token);
      }
      applyPublishedSnapshot(publishedSnapshot);
      toast.success("已恢复为上线版本");
    } catch {
      toast.error("恢复失败");
    }
  }, [applyPublishedSnapshot, hasSavedDraft, projectId, publishedSnapshot, token]);

  const handlePublish = React.useCallback(async () => {
    if (!token) {
      toast.error("未登录");
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("请先填写标题");
      setIsSettingsSheetOpen(true);
      return;
    }

    setPublishing(true);
    try {
      await persistDraft(true);
      const id = await ensureProject();
      const finalSlug = slug.trim() || urlSlug || slugify(trimmedTitle);

      await updatePostMeta(id, {
        title: trimmedTitle,
        summary: summary.trim(),
        slug: finalSlug || undefined,
        cover: cover || null,
        state: "public",
        tags,
        seo: {
          title: seoTitle.trim() || undefined,
          description: seoDescription.trim() || undefined,
          keywords: seoKeywords.trim() || undefined,
        },
      }, token);

      await publishDraft(id, publishMessage.trim() || "发布文章", token);
      await updateProjectState(id, "public", token);
      void fetch("/api/revalidate", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => null);

      toast.success("发布成功");
      setDirty(false);
      setHasSavedDraft(false);
      setIsSettingsSheetOpen(false);
      if (user?.username) {
        router.push(`/${user.username}/${encodeURIComponent(finalSlug)}`);
      } else {
        router.push("/posts");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }, [cover, ensureProject, persistDraft, publishMessage, router, seoDescription, seoKeywords, seoTitle, slug, summary, tags, title, token, urlSlug, user]);

  const handleDiscard = React.useCallback(async () => {
    if (!token) {
      toast.error("未登录");
      return;
    }
    if (!projectId) {
      resetEditor();
      toast.success("内容已重置");
      return;
    }
    if (!hasSavedDraft && publishedSnapshot) {
      await handleRestorePublished();
      return;
    }

    const ok = window.confirm(publishedSnapshot ? "确定要删除这份草稿吗？已上线版本会保留不变。" : "确定要丢弃这份草稿吗？此操作不可恢复。");
    if (!ok) return;

    try {
      const removed = await discardDraft(projectId, token);
      if (!removed) {
        toast.error("草稿删除失败");
        return;
      }
      if (publishedSnapshot) {
        applyPublishedSnapshot(publishedSnapshot);
        toast.success("草稿已删除，已恢复到上线版本");
        return;
      }
      resetEditor();
      router.replace("/write");
      toast.success("草稿已删除");
    } catch {
      toast.error("草稿删除失败");
    }
  }, [applyPublishedSnapshot, handleRestorePublished, hasSavedDraft, projectId, publishedSnapshot, resetEditor, router, token]);

  const markDirty = React.useCallback(() => setDirty(true), []);

  if (isPageLoading) return <WriteLoading label="正在加载编辑器" />;

  if (!isAuthed) {
    return (
      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <Card className="max-w-md w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader>
            <CardTitle>请先登录后写作</CardTitle>
            <CardDescription>编辑器、草稿与发布都需要登录身份。登录后即可开始创作。</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href={buildZcLoginUrl(typeof window !== "undefined" ? window.location.href : "")}>前往登录</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const statusIcon = saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" /> : dirty ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />;
  const statusLabel = saving ? "保存中" : dirty ? "未保存" : "已保存";
  const versionLabel = hasPublishedVersion ? (hasSavedDraft ? "草稿覆盖上线版本" : "正在查看上线版本") : (hasSavedDraft ? "草稿文章" : "新文章");

  const editorNode = (
    <div className="relative flex-1 min-h-0 animate-in fade-in duration-500">
      <div className="mx-auto h-full w-full max-w-3xl">
        <MilkdownEditorPane
          key={`milkdown-${editorSeed}`}
          token={token}
          initialValue={content}
          onChange={(value) => {
            setContent(value);
            setDirty(true);
          }}
        />
      </div>
    </div>
  );

  if (immersiveMode) {
    return (
      <section className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200">
        <header className="flex h-12 items-center justify-between border-b border-border/60 bg-background/90 px-4 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-sm font-medium">{title || "未命名文章"}</h2>
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{statusIcon}{statusLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => void persistDraft(false)} disabled={saving || publishing}><Save className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setImmersiveMode(false)}><Minimize2 className="h-4 w-4" />退出</Button>
          </div>
        </header>
        {editorNode}
      </section>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.14))] flex-1 flex-col md:min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
            <Link href="/drafts" className="shrink-0 transition-colors hover:text-foreground">草稿</Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium text-foreground">{title || "未命名文章"}</span>
            <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] sm:inline-flex">{versionLabel}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="hidden items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground md:inline-flex"><BookText className="h-3.5 w-3.5" />{wordCount}</span>
                </TooltipTrigger>
                <TooltipContent>字数</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{statusIcon}<span className="hidden sm:inline">{statusLabel}</span></span>
                </TooltipTrigger>
                <TooltipContent>{lastSavedAt ? `最近保存: ${formatDate(lastSavedAt)}` : "还未保存"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {liveHref && (
              <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
                <a href={liveHref} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />查看上线版本</a>
              </Button>
            )}

            {publishedSnapshot && (
              <Button variant="outline" size="sm" onClick={() => void handleRestorePublished()} disabled={!canRestorePublished} className="hidden lg:inline-flex">
                <RotateCcw className="h-3.5 w-3.5" />一键恢复
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={() => setIsSettingsSheetOpen(true)} className="hidden sm:inline-flex"><SlidersHorizontal className="h-3.5 w-3.5" />文章设置</Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => void persistDraft(false)} disabled={saving}><Save className="h-4 w-4" />立即保存</DropdownMenuItem>
                {liveHref && <DropdownMenuItem asChild><a href={liveHref} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />查看上线版本</a></DropdownMenuItem>}
                {publishedSnapshot && <DropdownMenuItem onClick={() => void handleRestorePublished()} disabled={!canRestorePublished}><RotateCcw className="h-4 w-4" />一键恢复为上线版本</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => setImmersiveMode(true)}><Maximize2 className="h-4 w-4" />沉浸模式</DropdownMenuItem>
                <DropdownMenuItem onClick={handleDiscard} className="text-destructive">{hasPublishedVersion ? "删除草稿" : "丢弃草稿"}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={() => {
              if (!title.trim()) {
                setIsSettingsSheetOpen(true);
                toast.info("补全信息后即可发布");
                return;
              }
              setIsSettingsSheetOpen(true);
            }} disabled={saving || publishing} className="gap-1.5">
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">发布</span>
            </Button>
          </div>
        </div>
      </header>

      {hasPublishedVersion && (
        <div className="border-b border-border/50 bg-muted/35 px-4 py-2 md:px-6">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{hasSavedDraft ? "你正在编辑一份独立草稿，删除草稿不会影响已上线文章。" : "当前内容就是已上线版本。"}</span>
            {liveHref && <a href={liveHref} target="_blank" rel="noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">查看上线版本</a>}
            {publishedSnapshot && <button type="button" onClick={() => void handleRestorePublished()} className="font-medium text-foreground underline-offset-4 hover:underline disabled:text-muted-foreground" disabled={!canRestorePublished}>一键恢复</button>}
          </div>
        </div>
      )}

      <div className="px-4 pb-2 pt-6 md:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <input type="text" value={title} onChange={(event) => {
            const next = event.target.value;
            setTitle(next);
            if (!seoTitle.trim() && next.trim()) setSeoTitle(next.trim());
            if (!slugTouched) setSlug(slugify(next));
            markDirty();
          }} placeholder="文章标题" className="w-full bg-transparent text-3xl font-bold leading-tight tracking-[-0.025em] outline-none placeholder:text-muted-foreground/40 md:text-4xl" />
          <input type="text" value={summary} onChange={(event) => {
            const next = event.target.value;
            setSummary(next);
            if (!seoDescription.trim() && next.trim()) setSeoDescription(next.trim());
            markDirty();
          }} placeholder="一句话摘要（可选）" className="mt-3 w-full bg-transparent text-lg text-muted-foreground outline-none placeholder:text-muted-foreground/40" />
        </div>
      </div>

      {editorNode}

      <Sheet open={isSettingsSheetOpen} onOpenChange={setIsSettingsSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>文章设置</SheetTitle>
            <SheetDescription>补全基础信息、SEO 和封面，然后一键发布。</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="basic">基础</TabsTrigger><TabsTrigger value="seo">SEO</TabsTrigger></TabsList>
              <TabsContent value="basic" className="mt-6 space-y-5">
                <div className="space-y-2"><Label>封面图</Label><CoverUpload value={cover} onChange={(url) => { setCover(url); markDirty(); }} token={token} /></div>
                <div className="space-y-2"><Label htmlFor="sheet-title">标题</Label><Input id="sheet-title" value={title} onChange={(event) => { const next = event.target.value; setTitle(next); if (!seoTitle.trim() && next.trim()) setSeoTitle(next.trim()); if (!slugTouched) setSlug(slugify(next)); markDirty(); }} placeholder="文章标题" /></div>
                <div className="space-y-2"><Label htmlFor="sheet-summary">摘要</Label><Textarea id="sheet-summary" value={summary} onChange={(event) => { const next = event.target.value; setSummary(next); if (!seoDescription.trim() && next.trim()) setSeoDescription(next.trim()); markDirty(); }} placeholder="简述文章主题" className="min-h-20" /></div>
                <div className="space-y-2"><Label htmlFor="sheet-slug">Slug</Label><Input id="sheet-slug" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); markDirty(); }} placeholder="modern-web-architecture" /><p className="text-xs text-muted-foreground">地址预览： <span className="font-mono text-foreground">/{user?.username || "username"}/{slug || "your-article-slug"}</span></p></div>
                <div className="space-y-2"><Label>标签</Label><PostTagSelector value={tags} onChange={(next) => { setTags(next); markDirty(); }} /></div>
              </TabsContent>
              <TabsContent value="seo" className="mt-6 space-y-5">
                <div className="space-y-2"><Label htmlFor="sheet-seo-title">SEO 标题</Label><Input id="sheet-seo-title" value={seoTitle} onChange={(event) => { setSeoTitle(event.target.value); setDirty(true); }} placeholder="用于搜索引擎显示" /><p className="text-xs text-muted-foreground">建议控制在 30 到 60 个字符，通常直接沿用文章标题即可。</p></div>
                <div className="space-y-2"><Label htmlFor="sheet-seo-description">SEO 描述</Label><Textarea id="sheet-seo-description" value={seoDescription} onChange={(event) => { setSeoDescription(event.target.value); setDirty(true); }} placeholder="搜索结果中的描述文本" className="min-h-20" /><p className="text-xs text-muted-foreground">建议 80 到 160 个字符，避免与摘要完全重复。</p></div>
                <div className="space-y-2"><Label htmlFor="sheet-canonical-url">Canonical URL</Label><Input id="sheet-canonical-url" value={canonicalUrl} onChange={(event) => { setCanonicalUrl(event.target.value); setDirty(true); }} placeholder="https://example.com/article" /></div>
                <div className="space-y-2"><Label htmlFor="sheet-seo-keywords">SEO 关键词</Label><Input id="sheet-seo-keywords" value={seoKeywords} onChange={(event) => { setSeoKeywords(event.target.value); markDirty(); }} placeholder="关键词1, 关键词2, 关键词3" /></div>
                <Separator />
                <div className="space-y-2"><Label htmlFor="publish-message">发布说明</Label><Textarea id="publish-message" value={publishMessage} onChange={(event) => setPublishMessage(event.target.value)} placeholder="提交说明（可选，用于 Git 历史）" className="min-h-20" /></div>
              </TabsContent>
            </Tabs>
          </div>
          <SheetFooter className="gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row">
            <Button variant="outline" onClick={() => setIsSettingsSheetOpen(false)} className="w-full sm:w-auto">返回编辑</Button>
            <Button onClick={() => void handlePublish()} disabled={saving || publishing} className="w-full sm:flex-1">{publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}发布文章</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

