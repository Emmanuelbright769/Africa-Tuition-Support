import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareText, Plus, Search, Heart, MessageSquare,
  Pin, ArrowLeft, Send, Users, Tag, Clock, Flame, TrendingUp,
  BookOpen, Loader2, CornerDownRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ForumTopic {
  id: number; title: string; body: string; authorId: number; authorName: string;
  section: string; tags: string[]; replyCount: number; likeCount: number;
  isPinned: boolean; createdAt: string; userLiked: boolean;
}
interface ForumPost {
  id: number; topicId: number; content: string; authorId: number; authorName: string;
  likeCount: number; createdAt: string; userLiked: boolean;
}

const SECTION_TAGS: Record<string, string[]> = {
  student:   ["General", "Study Tips", "Scholarships", "Verification", "Wallet", "Announcements"],
  affiliate: ["General", "Trade Market", "Referrals", "Business", "Trust Fund", "Announcements"],
};

const TAG_COLORS: Record<string, string> = {
  "Trade Market": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Announcements": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Scholarships": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "Referrals": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "Trust Fund": "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};
const tagClass = (tag: string) => TAG_COLORS[tag] ?? "bg-primary/10 text-primary";

function avatarInitials(name: string) {
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}
function avatarColor(name: string) {
  const colors = [
    "from-tsia-green to-emerald-500",
    "from-blue-500 to-indigo-500",
    "from-violet-500 to-purple-600",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-500",
    "from-cyan-500 to-teal-500",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

// ─── Topic Card ───────────────────────────────────────────────────────────────
function TopicCard({ topic, onClick }: { topic: ForumTopic; onClick: () => void }) {
  const qc = useQueryClient();
  const [liked, setLiked] = useState(topic.userLiked);
  const [count, setCount] = useState(topic.likeCount);

  const likeMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/forum/topics/${topic.id}/like`).then(r => r.json()),
    onMutate: () => {
      setLiked(l => !l);
      setCount(c => liked ? Math.max(0, c - 1) : c + 1);
    },
    onSuccess: (data: { liked: boolean; likeCount: number }) => {
      setLiked(data.liked);
      setCount(data.likeCount);
      qc.invalidateQueries({ queryKey: ["/api/forum/topics"] });
    },
    onError: () => { setLiked(topic.userLiked); setCount(topic.likeCount); },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-tsia-green/30 hover:shadow-md transition-all cursor-pointer group"
      onClick={onClick}
    >
      {topic.isPinned && (
        <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-0">
          <Pin className="w-3 h-3 text-tsia-gold" />
          <span className="text-[10px] font-bold text-tsia-gold uppercase tracking-wide">Pinned</span>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(topic.authorName)} flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5`}>
            {avatarInitials(topic.authorName)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-foreground leading-snug mb-1 line-clamp-2 group-hover:text-tsia-green transition-colors">
              {topic.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5 leading-relaxed">{topic.body}</p>
            {topic.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2.5">
                {topic.tags.map(tag => (
                  <span key={tag} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tagClass(tag)}`}>{tag}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 font-medium">{topic.authorName}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 shrink-0 ml-1">
            <button
              onClick={e => { e.stopPropagation(); likeMutation.mutate(); }}
              disabled={likeMutation.isPending}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-all ${liked ? "text-red-500" : "text-muted-foreground hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"}`}
              data-testid={`button-like-topic-${topic.id}`}
            >
              <Heart className={`w-4 h-4 transition-all ${liked ? "fill-current scale-110" : ""}`} />
              <span className="text-[10px] font-bold">{count}</span>
            </button>
            <div className="flex flex-col items-center gap-0.5 text-muted-foreground px-2">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">{topic.replyCount}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Topic Detail ─────────────────────────────────────────────────────────────
function TopicDetail({ topic: init, onBack }: { topic: ForumTopic; onBack: () => void; userSection: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [topicLiked, setTopicLiked] = useState(init.userLiked);
  const [topicLikeCount, setTopicLikeCount] = useState(init.likeCount);
  const [topicReplyCount, setTopicReplyCount] = useState(init.replyCount);

  const { data: posts = [], isLoading: postsLoading } = useQuery<ForumPost[]>({
    queryKey: [`/api/forum/topics/${init.id}/posts`],
    queryFn: () => apiRequest("GET", `/api/forum/topics/${init.id}/posts`).then(r => r.json()),
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/forum/topics/${init.id}/posts`, { content }).then(r => r.json()),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: [`/api/forum/topics/${init.id}/posts`] });
      setTopicReplyCount(c => c + 1);
      toast({ title: "Reply posted ✓", className: "border-tsia-green" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const likeTopicMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/forum/topics/${init.id}/like`).then(r => r.json()),
    onMutate: () => { setTopicLiked(l => !l); setTopicLikeCount(c => topicLiked ? Math.max(0, c - 1) : c + 1); },
    onSuccess: (data: { liked: boolean; likeCount: number }) => {
      setTopicLiked(data.liked); setTopicLikeCount(data.likeCount);
    },
    onError: () => { setTopicLiked(init.userLiked); setTopicLikeCount(init.likeCount); },
  });

  return (
    <div className="flex flex-col h-full min-h-[60vh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card/80 backdrop-blur-sm shrink-0 sticky top-0 z-10">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors" data-testid="button-forum-back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate leading-tight">{init.title}</p>
          <p className="text-[11px] text-muted-foreground">{topicReplyCount} replies · {topicLikeCount} likes</p>
        </div>
      </div>

      {/* Scrollable area */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-5 space-y-5 pb-32">
        {/* Original post */}
        <div className="rounded-2xl border border-tsia-green/20 bg-tsia-green/5 overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-tsia-green/10">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(init.authorName)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {avatarInitials(init.authorName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{init.authorName}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(init.createdAt), { addSuffix: true })}
              </p>
            </div>
            {init.tags?.map(tag => (
              <span key={tag} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${tagClass(tag)}`}>{tag}</span>
            ))}
          </div>
          <div className="px-4 py-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{init.body}</p>
          </div>
          <div className="px-4 pb-3 flex items-center gap-2">
            <button
              onClick={() => likeTopicMutation.mutate()}
              disabled={likeTopicMutation.isPending}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${topicLiked ? "bg-red-100 text-red-500 dark:bg-red-950/40" : "bg-muted text-muted-foreground hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"}`}
              data-testid="button-like-topic-detail"
            >
              <Heart className={`w-3.5 h-3.5 ${topicLiked ? "fill-current" : ""}`} />
              {topicLiked ? "Liked" : "Like"} · {topicLikeCount}
            </button>
          </div>
        </div>

        {/* Replies */}
        {postsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-tsia-green" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-sm text-muted-foreground">No replies yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Be the first to join this discussion</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{posts.length} {posts.length === 1 ? "Reply" : "Replies"}</span>
            </div>
            {posts.map(post => (
              <PostCard key={post.id} post={post} isOwn={post.authorId === user?.id} topicId={init.id} />
            ))}
          </div>
        )}
      </div>

      {/* Reply composer */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 border-t bg-background/95 backdrop-blur-sm z-20">
        <div className="flex gap-2 max-w-lg mx-auto">
          <Input
            placeholder="Write a reply..."
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && reply.trim()) { e.preventDefault(); replyMutation.mutate(reply.trim()); }}}
            className="h-11 rounded-2xl bg-muted border-0 focus-visible:ring-1 focus-visible:ring-tsia-green text-sm"
            data-testid="input-forum-reply"
          />
          <Button
            onClick={() => { if (reply.trim()) replyMutation.mutate(reply.trim()); }}
            disabled={!reply.trim() || replyMutation.isPending}
            className="h-11 w-11 rounded-2xl bg-tsia-green hover:bg-tsia-green/90 shrink-0 p-0"
            data-testid="button-forum-reply-send"
          >
            {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Post (Reply) Card ────────────────────────────────────────────────────────
function PostCard({ post, isOwn, topicId }: { post: ForumPost; isOwn: boolean; topicId: number }) {
  const qc = useQueryClient();
  const [liked, setLiked] = useState(post.userLiked);
  const [count, setCount] = useState(post.likeCount);

  const likeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/forum/posts/${post.id}/like`).then(r => r.json()),
    onMutate: () => { setLiked(l => !l); setCount(c => liked ? Math.max(0, c - 1) : c + 1); },
    onSuccess: (data: { liked: boolean; likeCount: number }) => {
      setLiked(data.liked); setCount(data.likeCount);
      qc.invalidateQueries({ queryKey: [`/api/forum/topics/${topicId}/posts`] });
    },
    onError: () => { setLiked(post.userLiked); setCount(post.likeCount); },
  });

  return (
    <div className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(post.authorName)} flex items-center justify-center text-white font-bold text-xs shrink-0 mt-1`}>
        {avatarInitials(post.authorName)}
      </div>
      <div className={`flex-1 max-w-[85%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`flex items-center gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="text-xs font-bold text-foreground">{isOwn ? "You" : post.authorName}</span>
          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
        </div>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isOwn
            ? "bg-tsia-green text-white rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        }`}>
          {post.content}
        </div>
        <button
          onClick={() => likeMutation.mutate()}
          disabled={likeMutation.isPending}
          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all ${
            liked ? "text-red-500" : "text-muted-foreground hover:text-red-400"
          }`}
          data-testid={`button-like-post-${post.id}`}
        >
          <Heart className={`w-3 h-3 ${liked ? "fill-current" : ""}`} />
          {count > 0 ? count : "Like"}
        </button>
      </div>
    </div>
  );
}

// ─── New Topic Modal ──────────────────────────────────────────────────────────
function NewTopicModal({ onClose, userSection }: { onClose: () => void; userSection: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const tags = SECTION_TAGS[userSection] ?? SECTION_TAGS.student;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/forum/topics", {
        title: title.trim(), body: body.trim(),
        section: userSection, tags: selectedTags,
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/forum/topics"] });
      toast({ title: "Discussion published! ✓", className: "border-tsia-green" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="font-black text-base">New Discussion</p>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!title.trim() || !body.trim() || createMutation.isPending}
          className="bg-tsia-green hover:bg-tsia-green/90 text-white rounded-xl h-9 px-4 font-bold"
          data-testid="button-forum-post"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-5 space-y-5">
        {/* Title */}
        <div>
          <label className="text-xs font-black text-muted-foreground mb-1.5 block uppercase tracking-wider">Title</label>
          <Input
            placeholder="What do you want to discuss?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="h-12 text-base font-medium rounded-xl border-border bg-muted/40 focus-visible:ring-tsia-green"
            maxLength={120}
            data-testid="input-forum-title"
          />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">{title.length}/120</p>
        </div>

        {/* Body */}
        <div>
          <label className="text-xs font-black text-muted-foreground mb-1.5 block uppercase tracking-wider">Message</label>
          <textarea
            placeholder="Share your thoughts, questions, or insights..."
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={7}
            className="w-full rounded-xl border border-border bg-muted/40 px-3 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-tsia-green leading-relaxed"
            data-testid="input-forum-body"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-black text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wider">
            <Tag className="w-3.5 h-3.5" /> Tags <span className="font-normal normal-case tracking-normal text-muted-foreground/60">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTags(prev =>
                  prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                )}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedTags.includes(tag)
                    ? "bg-tsia-green text-white shadow-sm scale-105"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Preview hint */}
        {title && (
          <div className="rounded-xl border border-dashed border-border p-4 bg-muted/20">
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Preview</p>
            <p className="font-bold text-sm">{title}</p>
            {body && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{body}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Forum Section (main) ─────────────────────────────────────────────────────
export default function ForumSection({ userSection }: { userSection: "student" | "affiliate" }) {
  const [search, setSearch] = useState("");
  const [activeTopic, setActiveTopic] = useState<ForumTopic | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"latest" | "popular">("latest");

  const { data: topics = [], isLoading } = useQuery<ForumTopic[]>({
    queryKey: ["/api/forum/topics", userSection],
    queryFn: () => apiRequest("GET", `/api/forum/topics?section=${userSection}`).then(r => r.json()),
    refetchInterval: 300_000,
  });

  const filtered = topics
    .filter(t => {
      if (activeTag && !t.tags?.includes(activeTag)) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.body.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sortBy === "popular") return b.likeCount - a.likeCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const pinned = filtered.filter(t => t.isPinned);
  const regular = filtered.filter(t => !t.isPinned);
  const allTags = Array.from(new Set(topics.flatMap(t => t.tags ?? [])));
  const totalLikes = topics.reduce((s, t) => s + t.likeCount, 0);

  if (showNew) return <NewTopicModal onClose={() => setShowNew(false)} userSection={userSection} />;
  if (activeTopic) return <TopicDetail topic={activeTopic} onBack={() => setActiveTopic(null)} userSection={userSection} />;

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2 leading-tight">
            <div className="w-8 h-8 rounded-xl bg-tsia-green flex items-center justify-center shrink-0">
              <MessageSquareText className="w-4 h-4 text-white" />
            </div>
            Community Forum
          </h2>
          <p className="text-xs text-muted-foreground mt-1 ml-10">
            {userSection === "student"
              ? "Discuss studies, scholarships and wallet tips with fellow students"
              : "Share trade insights, referral strategies and opportunities"}
          </p>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="bg-tsia-green hover:bg-tsia-green/90 text-white rounded-2xl h-10 px-4 font-bold text-sm shrink-0 shadow-sm"
          data-testid="button-forum-new-topic"
        >
          <Plus className="w-4 h-4 mr-1" /> Post
        </Button>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: BookOpen, label: "Discussions", val: topics.length, color: "text-tsia-green" },
          { icon: Users, label: "Contributors", val: new Set(topics.map(t => t.authorId)).size, color: "text-blue-500" },
          { icon: Heart, label: "Total Likes", val: totalLikes, color: "text-red-500" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
            <p className="font-black text-base leading-none">{s.val}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search discussions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-11 bg-muted/40 border-border rounded-2xl focus-visible:ring-tsia-green text-sm"
          data-testid="input-forum-search"
        />
      </div>

      {/* ── Sort + Tag filters ──────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
        {/* Sort toggles */}
        <button
          onClick={() => setSortBy("latest")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${sortBy === "latest" ? "bg-tsia-green text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Clock className="w-3 h-3" /> Latest
        </button>
        <button
          onClick={() => setSortBy("popular")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${sortBy === "popular" ? "bg-tsia-gold text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Flame className="w-3 h-3" /> Popular
        </button>
        {/* Divider */}
        {allTags.length > 0 && <div className="w-px bg-border shrink-0 my-1" />}
        {/* Tag chips */}
        {allTags.length > 0 && (
          <>
            <button
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${!activeTag ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(t => t === tag ? null : tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${activeTag === tag ? "bg-tsia-green text-white" : "bg-muted text-muted-foreground"}`}
              >
                {tag}
              </button>
            ))}
          </>
        )}
      </div>

      {/* ── Topics list ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-tsia-green" />
            <p className="text-sm text-muted-foreground">Loading discussions...</p>
          </div>
        ) : filtered.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <MessageSquareText className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <p className="font-bold text-base text-foreground mb-1">
              {search || activeTag ? "No matching discussions" : "No discussions yet"}
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              {search || activeTag ? "Try a different search or tag" : "Be the first to start a conversation!"}
            </p>
            {!search && !activeTag && (
              <Button onClick={() => setShowNew(true)} className="bg-tsia-green text-white rounded-2xl font-bold">
                <Plus className="w-4 h-4 mr-1.5" /> Start a Discussion
              </Button>
            )}
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {pinned.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <Pin className="w-3.5 h-3.5 text-tsia-gold" />
                  <span className="text-xs font-black text-tsia-gold uppercase tracking-wider">Pinned</span>
                </div>
                {pinned.map(t => <TopicCard key={t.id} topic={t} onClick={() => setActiveTopic(t)} />)}
                {regular.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                      {sortBy === "popular" ? "Most Liked" : "Recent"}
                    </span>
                  </div>
                )}
              </>
            )}
            {regular.map(t => <TopicCard key={t.id} topic={t} onClick={() => setActiveTopic(t)} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
