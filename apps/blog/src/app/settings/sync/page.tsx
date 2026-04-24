"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Folder,
  GitBranch,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  ExternalLink,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { buildZcLoginUrl, useAuthToken } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import {
  createGitInstallUrl,
  disableBlogSync,
  frameworkDefaults,
  getBlogSyncSettings,
  getGitAccounts,
  getRepoBranches,
  getRepos,
  listBlogSyncProjects,
  resyncAllBlogPosts,
  syncBlogProject,
  updateBlogSyncSettings,
  type BlogSyncProject,
  type BlogSyncSettings,
  type GitAccount,
  type GitRepo,
} from "@/lib/blog-sync";

type FormState = Required<
  Pick<
    BlogSyncSettings,
    | "enabled"
    | "repoOwner"
    | "repoName"
    | "branch"
    | "directory"
    | "framework"
    | "fileNameTemplate"
    | "excludeReadme"
    | "allowPrivateToPublic"
  >
> & {
  linkId: number | null;
  frontMatter: Required<NonNullable<BlogSyncSettings["frontMatter"]>>;
};

const DEFAULT_FORM: FormState = {
  enabled: false,
  linkId: null,
  repoOwner: "",
  repoName: "",
  branch: "main",
  directory: "source/_posts",
  framework: "hexo",
  fileNameTemplate: "{slug}.md",
  excludeReadme: true,
  allowPrivateToPublic: false,
  frontMatter: {
    includeTitle: true,
    includeDate: true,
    includeTags: true,
    includeDescription: true,
  },
};

export default function BlogSyncPage() {
  const { token, ready, isAuthed } = useAuthToken();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [resyncing, setResyncing] = React.useState(false);
  const [linkingRepo, setLinkingRepo] = React.useState(false);
  const [accounts, setAccounts] = React.useState<GitAccount[]>([]);
  const [settings, setSettings] = React.useState<BlogSyncSettings | null>(null);
  const [projects, setProjects] = React.useState<BlogSyncProject[]>([]);
  const [repos, setRepos] = React.useState<GitRepo[]>([]);
  const [reposLoading, setReposLoading] = React.useState(false);
  const [branches, setBranches] = React.useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);

  const refresh = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [accountsData, settingsData, projectsData] = await Promise.all([
        getGitAccounts(token),
        getBlogSyncSettings(token),
        listBlogSyncProjects(token),
      ]);
      setAccounts(accountsData);
      setSettings(settingsData);
      setProjects(projectsData);

      if (settingsData) {
        setForm((prev) => ({
          ...prev,
          enabled: Boolean(settingsData.enabled),
          linkId: settingsData.linkId ?? null,
          repoOwner: settingsData.repoOwner || "",
          repoName: settingsData.repoName || "",
          branch: settingsData.branch || "main",
          directory:
            settingsData.directory ||
            frameworkDefaults[settingsData.framework ?? "hexo"] ||
            "source/_posts",
          framework: (settingsData.framework ?? "hexo") as FormState["framework"],
          fileNameTemplate: settingsData.fileNameTemplate || "{slug}.md",
          excludeReadme: settingsData.excludeReadme ?? true,
          allowPrivateToPublic: settingsData.allowPrivateToPublic ?? false,
          frontMatter: {
            includeTitle: settingsData.frontMatter?.includeTitle ?? true,
            includeDate: settingsData.frontMatter?.includeDate ?? true,
            includeTags: settingsData.frontMatter?.includeTags ?? true,
            includeDescription: settingsData.frontMatter?.includeDescription ?? true,
          },
        }));
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (!ready || !isAuthed) return;
    void refresh();
  }, [ready, isAuthed, refresh]);

  const updateField = React.useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateFrontMatter = React.useCallback(
    (key: keyof FormState["frontMatter"], value: boolean) => {
      setForm((prev) => ({
        ...prev,
        frontMatter: { ...prev.frontMatter, [key]: value },
      }));
    },
    []
  );

  /* Load repos when link changes */
  React.useEffect(() => {
    if (!token || !form.linkId) {
      setRepos([]);
      return;
    }
    let canceled = false;
    setReposLoading(true);
    getRepos(form.linkId, token)
      .then((list) => {
        if (!canceled) setRepos(list);
      })
      .finally(() => {
        if (!canceled) setReposLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [form.linkId, token]);

  /* Load branches when repo changes */
  React.useEffect(() => {
    if (!token || !form.linkId || !form.repoOwner || !form.repoName) {
      setBranches([]);
      return;
    }
    let canceled = false;
    setBranchesLoading(true);
    getRepoBranches(
      {
        linkId: form.linkId,
        repoOwner: form.repoOwner,
        repoName: form.repoName,
      },
      token
    )
      .then((list) => {
        if (!canceled) setBranches(list.length ? list : ["main"]);
      })
      .finally(() => {
        if (!canceled) setBranchesLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [form.linkId, form.repoOwner, form.repoName, token]);

  const selectedAccount = accounts.find((a) => a.id === form.linkId) || null;
  const canSave =
    form.linkId !== null &&
    Boolean(form.repoOwner && form.repoName && form.branch) &&
    !saving;

  const handleSave = async () => {
    if (!token || !canSave) return;
    setSaving(true);
    try {
      await updateBlogSyncSettings(
        {
          enabled: form.enabled,
          linkId: form.linkId!,
          repoOwner: form.repoOwner,
          repoName: form.repoName,
          branch: form.branch,
          directory: form.directory,
          framework: form.framework,
          fileNameTemplate: form.fileNameTemplate,
          excludeReadme: form.excludeReadme,
          allowPrivateToPublic: form.allowPrivateToPublic,
          frontMatter: form.frontMatter,
        },
        token
      );
      toast.success("已保存博客同步配置");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleResync = async () => {
    if (!token) return;
    setResyncing(true);
    try {
      await resyncAllBlogPosts(token);
      toast.success("已触发全量重同步");
      setTimeout(() => void refresh(), 800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "同步失败");
    } finally {
      setResyncing(false);
    }
  };

  const handleSyncOne = async (projectId: number | string) => {
    if (!token) return;
    try {
      await syncBlogProject(projectId, token);
      toast.success("已触发同步");
      setTimeout(() => void refresh(), 600);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "同步失败");
    }
  };

  const handleDisable = async () => {
    if (!token) return;
    try {
      await disableBlogSync(token);
      toast.success("已禁用博客同步");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "禁用失败");
    }
  };

  const handleConnectGithub = async () => {
    if (!token) return;
    setLinkingRepo(true);
    try {
      const url = await createGitInstallUrl(window.location.href, token);
      if (!url) {
        toast.error("获取 GitHub 授权链接失败");
        return;
      }
      window.location.href = url;
    } finally {
      setLinkingRepo(false);
    }
  };

  if (!ready) {
    return <PageSkeleton />;
  }

  if (!isAuthed) {
    return (
      <section className="mx-auto w-full max-w-2xl px-6 py-16">
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader>
            <CardTitle>登录后配置 GitHub 同步</CardTitle>
            <CardDescription>
              把文章自动推送到你的 GitHub 仓库，兼容 Hexo / Hugo / Valaxy 等博客框架。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link
                href={buildZcLoginUrl(
                  typeof window !== "undefined" ? window.location.href : ""
                )}
              >
                前往登录
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 md:px-6 py-10 space-y-6">
      <header>
        <p className="text-mono-label text-muted-foreground/70">Integrations</p>
        <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-[-0.025em] flex items-center gap-3">
          <GitBranch className="h-8 w-8" />
          GitHub 博客同步
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          将所有文章项目自动推送到 GitHub 仓库，兼容 Hexo / Hugo / Valaxy 博客框架。
        </p>
      </header>

      {/* Enable toggle */}
      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)] dark:bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">启用自动同步</p>
            <p className="text-sm text-muted-foreground">
              {form.enabled ? "文章发布后将自动写入目标仓库" : "当前为只读配置，不会推送"}
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(value) => updateField("enabled", value)}
          />
        </CardContent>
      </Card>

      {/* Status summary */}
      {settings?.enabled && (
        <StatusCard settings={settings} projects={projects} />
      )}

      {/* Github account */}
      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            GitHub 账号
          </CardTitle>
          <CardDescription>
            选择已授权的 GitHub 账号，或绑定一个新账号。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>还没有绑定任何账号</AlertTitle>
              <AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleConnectGithub}
                  disabled={linkingRepo}
                >
                  {linkingRepo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <GitBranch className="h-3.5 w-3.5" />
                  )}
                  绑定 GitHub 账号
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <Select
                value={form.linkId ? String(form.linkId) : ""}
                onValueChange={(value) => {
                  const parsed = Number.parseInt(value, 10);
                  updateField("linkId", Number.isFinite(parsed) ? parsed : null);
                  // reset repo on account change
                  updateField("repoOwner", "");
                  updateField("repoName", "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择 GitHub 账号" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      <span className="inline-flex items-center gap-2">
                        <GitBranch className="h-3.5 w-3.5" />
                        {account.account?.login || `账号 #${account.id}`}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="link"
                size="sm"
                onClick={handleConnectGithub}
                disabled={linkingRepo}
                className="px-0"
              >
                添加更多账号
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repo & branch */}
      {form.linkId !== null && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              仓库与分支
            </CardTitle>
            <CardDescription>
              {selectedAccount?.account?.login && (
                <>选择 <span className="font-medium">{selectedAccount.account.login}</span> 账号下的仓库作为博客托管仓库。</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>目标仓库</Label>
              {reposLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={
                    form.repoOwner && form.repoName
                      ? `${form.repoOwner}/${form.repoName}`
                      : ""
                  }
                  onValueChange={(value) => {
                    const [owner, name] = value.split("/");
                    updateField("repoOwner", owner || "");
                    updateField("repoName", name || "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择仓库" />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((repo) => (
                      <SelectItem
                        key={`${repo.owner}/${repo.name}`}
                        value={`${repo.owner}/${repo.name}`}
                      >
                        <span className="inline-flex items-center gap-2">
                          {repo.owner}/{repo.name}
                          {repo.private && (
                            <Badge variant="secondary" className="text-[10px]">
                              private
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                    {repos.length === 0 && (
                      <SelectItem value="__empty__" disabled>
                        暂无可用仓库
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {form.repoOwner && form.repoName && (
              <div className="space-y-2">
                <Label>分支</Label>
                {branchesLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={form.branch}
                    onValueChange={(value) => updateField("branch", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(branches.length ? branches : ["main"]).map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Framework */}
      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CardHeader>
          <CardTitle>博客框架</CardTitle>
          <CardDescription>
            选择博客框架，自动应用对应的目录结构和 Front Matter 格式。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <RadioGroup
            value={form.framework}
            onValueChange={(value) => {
              const fw = value as FormState["framework"];
              updateField("framework", fw);
              if (frameworkDefaults[fw]) {
                updateField("directory", frameworkDefaults[fw]);
              }
            }}
            className="grid grid-cols-3 gap-2"
          >
            {(["hexo", "hugo", "valaxy"] as const).map((fw) => (
              <Label
                key={fw}
                htmlFor={`fw-${fw}`}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-3 text-sm font-medium transition-all hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]/40 has-[:checked]:border-[var(--color-brand)] has-[:checked]:bg-[var(--color-brand-soft)] has-[:checked]:text-[var(--color-brand)] dark:has-[:checked]:bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)]"
              >
                <RadioGroupItem id={`fw-${fw}`} value={fw} className="sr-only" />
                <span className="capitalize">{fw}</span>
              </Label>
            ))}
          </RadioGroup>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="directory">目录</Label>
              <Input
                id="directory"
                value={form.directory}
                onChange={(e) => updateField("directory", e.target.value)}
                placeholder={frameworkDefaults[form.framework]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fileNameTemplate">文件名模板</Label>
              <Input
                id="fileNameTemplate"
                value={form.fileNameTemplate}
                onChange={(e) => updateField("fileNameTemplate", e.target.value)}
                placeholder="{slug}.md"
              />
              <p className="text-xs text-muted-foreground">
                支持 {"{slug}"} {"{id}"} {"{name}"}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Front Matter 字段</Label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["includeTitle", "标题"],
                  ["includeDate", "日期"],
                  ["includeTags", "标签"],
                  ["includeDescription", "描述"],
                ] as const
              ).map(([key, label]) => (
                <Label
                  key={key}
                  htmlFor={`fm-${key}`}
                  className="cursor-pointer flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <Checkbox
                    id={`fm-${key}`}
                    checked={form.frontMatter[key]}
                    onCheckedChange={(value) => updateFrontMatter(key, Boolean(value))}
                  />
                  {label}
                </Label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety */}
      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CardHeader>
          <CardTitle>安全范围</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label
            htmlFor="excludeReadme"
            className="cursor-pointer flex items-start gap-3 rounded-md border border-border bg-card p-3"
          >
            <Checkbox
              id="excludeReadme"
              checked={form.excludeReadme}
              onCheckedChange={(value) => updateField("excludeReadme", Boolean(value))}
            />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">排除与用户名同名的项目</p>
              <p className="text-xs text-muted-foreground">通常是个人主页的 README 项目。</p>
            </div>
          </Label>

          <Label
            htmlFor="allowPrivateToPublic"
            className="cursor-pointer flex items-start gap-3 rounded-md border border-border bg-card p-3"
          >
            <Checkbox
              id="allowPrivateToPublic"
              checked={form.allowPrivateToPublic}
              onCheckedChange={(value) => updateField("allowPrivateToPublic", Boolean(value))}
            />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">允许把私密项目同步到公开仓库</p>
              <p className="text-xs text-muted-foreground">默认关闭，避免泄露私密内容。</p>
            </div>
          </Label>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 sticky bottom-4 z-10 rounded-2xl border border-border bg-background/80 backdrop-blur-md px-4 py-3 shadow-card-lift">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={!settings?.enabled}
            >
              <Trash2 className="h-4 w-4" />
              禁用同步
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确定要禁用博客同步吗？</AlertDialogTitle>
              <AlertDialogDescription>
                禁用后现有配置将被保留，但不会推送任何变更到 GitHub。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisable}>确认禁用</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleResync}
            disabled={resyncing || !settings?.enabled}
          >
            {resyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            全量重同步
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存配置
          </Button>
        </div>
      </div>

      {/* Project list */}
      {projects.length > 0 && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader>
            <CardTitle>文章项目 ({projects.length})</CardTitle>
            <CardDescription>每一篇文章对应一个项目，可手动触发同步。</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {projects.map((p) => (
                <li key={p.id} className="flex items-start gap-3 py-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.title || p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.name}
                      {p.syncState?.filePath ? ` · ${p.syncState.filePath}` : ""}
                      {p.syncState?.lastSyncedAt
                        ? ` · ${formatDate(p.syncState.lastSyncedAt)}`
                        : ""}
                    </p>
                    {p.syncState?.lastError && (
                      <p className="text-xs text-destructive mt-1">
                        错误: {p.syncState.lastError}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.state === "private" && (
                      <Badge variant="secondary" className="text-[10px]">
                        私密
                      </Badge>
                    )}
                    {p.syncState?.lastSyncedAt && !p.syncState?.lastError && (
                      <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-200 dark:border-emerald-900">
                        <CheckCircle2 className="h-3 w-3" />
                        已同步
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleSyncOne(p.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function StatusCard({
  settings,
  projects,
}: {
  settings: BlogSyncSettings;
  projects: BlogSyncProject[];
}) {
  const totalCount = projects.length;
  const syncedCount = projects.filter((p) => p.syncState?.lastSyncedAt).length;
  const errorCount = projects.filter((p) => p.syncState?.lastError).length;

  const lastSyncedAt = React.useMemo(() => {
    const times = projects
      .map((p) => p.syncState?.lastSyncedAt)
      .filter(Boolean)
      .map((value) => (value ? new Date(value).getTime() : NaN))
      .filter((value) => Number.isFinite(value));
    if (!times.length) return null;
    return new Date(Math.max(...times)).toISOString();
  }, [projects]);

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <CardTitle className="text-base">同步状态</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {settings.repoOwner}/{settings.repoName} · {settings.branch}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <StatNum label="文章项目" value={totalCount} />
          <StatNum label="已同步" value={syncedCount} />
          <StatNum label="同步失败" value={errorCount} error={errorCount > 0} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          最近同步：{lastSyncedAt ? formatDate(lastSyncedAt) : "尚未同步"}
        </p>
      </CardContent>
    </Card>
  );
}

function StatNum({
  label,
  value,
  error,
}: {
  label: string;
  value: number;
  error?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={error ? "text-2xl font-semibold text-destructive" : "text-2xl font-semibold"}>
        {value}
      </p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 md:px-6 py-10 space-y-6">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-5 w-80" />
      {Array.from({ length: 3 }).map((_, idx) => (
        <Skeleton key={idx} className="h-40 w-full rounded-xl" />
      ))}
    </section>
  );
}
