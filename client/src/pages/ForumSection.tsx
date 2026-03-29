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
  Pin, ArrowLeft, Send, ChevronRight, Users, Tag, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ForumTopic {
  id: number; title: string; body: string; authorId: number; authorName: string;
  section: string; tags: string[]; replyCount: number; likeCount: number;
  isPinned: boolean; createdAt: string;
}
interface ForumPost {
  id: number; topicId: number; content: string; authorId: number; authorName: string;
  likeCount: number; createdAt: string;
}

const SECTION_TAGS: Record<string, string[]> = {
  student:   ["General", "Study Tips", "Scholarships", "Verification", "Wallet", "Announcements"],
  affiliate: ["General", "Trade Market", "Referrals", "Business", "Trust Fund", "Announcements"],
};

function avatarInitials(name: string) {
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

function TopicCard({ topic, onClick }: { topic: ForumTopic; onClick: () => void }) {
  const qc = useQueryClient();
  const likeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/forum/topics/${topic.id}/like`).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/forum/topics"] }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-tsia-green to-emerald-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {avatarInitials(topic.authorName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            {topic.isPinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full shrink-0 mt-0.5">
                <Pin className="w-2.5 h-2.5" /> Pinned
              </span>
            )}
            <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-2">{topic.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{topic.body}</p>
          {topic.tags && topic.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {topic.tags.map(tag => (
                <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{tag}</span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{topic.authorName}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); likeMutation.mutate(); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-muted"
          >
            <Heart className="w-3.5 h-3.5" /> {topic.likeCount}
          </button>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="w-3.5 h-3.5" /> {topic.replyCount}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 mt-1" />
        </div>
      </div>
    </motion.div>
  );
}

function TopicDetail({ topic: initial, onBack, userSection }: { topic: ForumTopic; onBack: () => void; userSection: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [topic, setTopic] = useState(initial);

  const { data: posts = [] } = useQuery<ForumPost[]>({
    queryKey: [`/api/forum/topics/${topic.id}/posts`],
    queryFn: () => apiRequest("GET", `/api/forum/topics/${topic.id}/posts`).then(r => r.json()),
    refetchInterval: 10_000,
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/forum/topics/${topic.id}/posts`, { content }).then(r => r.json()),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: [`/api/forum/topics/${topic.id}/posts`] });
      setTopic(t => ({ ...t, replyCount: t.replyCount + 1 }));
      toast({ title: "Reply posted" });
    },
  });

  const likePost = useMutation({
    mutationFn: (postId: number) =>
      apiRequest("POST", `/api/forum/posts/${postId}/like`).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/forum/topics/${topic.id}/posts`] }),
  });

  const likeTopic = useMutation({
    mutationFn: () => apiRequest("POST", `/api/forum/topics/${topic.id}/like`).then(r => r.json()),
    onSuccess: () => setTopic(t => ({ ...t, likeCount: t.likeCount + 1 })),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{topic.title}</p>
          <p className="text-xs text-muted-foreground">{topic.replyCount} replies · {topic.likeCount} likes</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-4 space-y-4">
        {/* Original post */}
        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-tsia-green to-emerald-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {avatarInitials(topic.authorName)}
            </div>
            <div>
              <p className="font-bold text-sm">{topic.authorName}</p>
              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true })}</p>
            </div>
            {topic.tags?.map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px] ml-auto">{tag}</Badge>
            ))}
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{topic.body}</p>
          <button
            onClick={() => likeTopic.mutate()}
            className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Heart className="w-3.5 h-3.5" /> {topic.likeCount} likes
          </button>
        </div>

        {/* Replies */}
        {posts.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No replies yet — be the first!</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="flex gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                post.authorId === user?.id
                  ? "bg-gradient-to-br from-tsia-green to-emerald-400"
                  : "bg-gradient-to-br from-blue-500 to-indigo-400"
              }`}>
                {avatarInitials(post.authorName)}
              </div>
              <div className="flex-1 bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-semibold text-xs">{post.authorName}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                <button
                  onClick={() => likePost.mutate(post.id)}
                  className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Heart className="w-3 h-3" /> {post.likeCount}
                </button>
              </div>
            </div>
          ))
        )}
        <div className="h-4" />
      </div>

      {/* Reply input */}
      <div className="px-4 py-3 border-t bg-background shrink-0">
        <div className="flex gap-2">
          <Input
            placeholder="Write a reply..."
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (reply.trim()) replyMutation.mutate(reply.trim()); }}}
            className="h-10 rounded-xl bg-muted border-0 focus-visible:ring-1"
            data-testid="input-forum-reply"
          />
          <Button
            size="sm"
            onClick={() => { if (reply.trim()) replyMutation.mutate(reply.trim()); }}
            disabled={!reply.trim() || replyMutation.isPending}
            className="h-10 w-10 rounded-xl bg-tsia-green hover:bg-tsia-green/90 shrink-0 p-0"
            data-testid="button-forum-reply-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewTopicModal({ onClose, userSection }: { onClose: () => void; userSection: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const tags = SECTION_TAGS[userSection] ?? SECTION_TAGS.student;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/forum/topics", {
        title: title.trim(),
        body: body.trim(),
        section: userSection,
        tags: selectedTags,
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/forum/topics"] });
      toast({ title: "Topic posted!", description: "Your discussion has been published." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="font-bold text-base">New Discussion</p>
        <Button
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={!title.trim() || !body.trim() || createMutation.isPending}
          className="bg-tsia-green hover:bg-tsia-green/90 text-white rounded-xl h-9 px-4"
          data-testid="button-forum-post"
        >
          Post
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-5 space-y-5">
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">TITLE</label>
          <Input
            placeholder="What do you want to discuss?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="h-12 text-base font-medium border-border bg-muted/30"
            maxLength={120}
            data-testid="input-forum-title"
          />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">{title.length}/120</p>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">BODY</label>
          <textarea
            placeholder="Share your thoughts, questions, or insights..."
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={7}
            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="input-forum-body"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" /> TAGS (optional)
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
                    ? "bg-tsia-green text-white shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForumSection({ userSection }: { userSection: "student" | "affiliate" }) {
  const [search, setSearch] = useState("");
  const [activeTopic, setActiveTopic] = useState<ForumTopic | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const { data: topics = [] } = useQuery<ForumTopic[]>({
    queryKey: ["/api/forum/topics", userSection],
    queryFn: () =>
      apiRequest("GET", `/api/forum/topics?section=${userSection}`).then(r => r.json()),
    refetchInterval: 15_000,
  });

  const filtered = topics.filter(t => {
    if (activeTag && !t.tags?.includes(activeTag)) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !t.body.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pinned = filtered.filter(t => t.isPinned);
  const regular = filtered.filter(t => !t.isPinned);
  const allTags = Array.from(new Set(topics.flatMap(t => t.tags ?? [])));

  if (showNew) return <NewTopicModal onClose={() => setShowNew(false)} userSection={userSection} />;
  if (activeTopic) return <TopicDetail topic={activeTopic} onBack={() => setActiveTopic(null)} userSection={userSection} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquareText className="w-6 h-6 text-tsia-green" /> Community Forum
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {userSection === "student" ? "Discuss studies, scholarships and TSIA with fellow students" : "Share insights, strategies and opportunities with affiliates"}
          </p>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="bg-tsia-green hover:bg-tsia-green/90 text-white rounded-xl h-10 px-4 shrink-0"
          data-testid="button-forum-new-topic"
        >
          <Plus className="w-4 h-4 mr-1.5" /> New Post
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search discussions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-10 bg-muted/40 border-border rounded-xl"
          data-testid="input-forum-search"
        />
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
              !activeTag ? "bg-tsia-green text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(t => t === tag ? null : tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                activeTag === tag ? "bg-tsia-green text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 rounded-xl px-4 py-2.5">
        <span className="flex items-center gap-1"><MessageSquareText className="w-3.5 h-3.5" /> {topics.length} discussions</span>
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {new Set(topics.map(t => t.authorId)).size} contributors</span>
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Pin className="w-3.5 h-3.5" /> Pinned
          </p>
          {pinned.map(t => <TopicCard key={t.id} topic={t} onClick={() => setActiveTopic(t)} />)}
        </div>
      )}

      {/* Regular */}
      <div className="space-y-3">
        {regular.length === 0 && pinned.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquareText className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
            <p className="font-bold text-muted-foreground">No discussions yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Be the first to start a conversation!</p>
            <Button onClick={() => setShowNew(true)} className="mt-4 bg-tsia-green hover:bg-tsia-green/90 text-white rounded-xl">
              Start a Discussion
            </Button>
          </div>
        ) : (
          regular.map(t => <TopicCard key={t.id} topic={t} onClick={() => setActiveTopic(t)} />)
        )}
      </div>
    </div>
  );
}
