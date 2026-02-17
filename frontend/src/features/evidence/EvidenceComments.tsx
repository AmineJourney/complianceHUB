/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { evidenceApi } from "../../api/evidence";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/button";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { formatDateTime, getInitials } from "../../lib/utils";
import type { EvidenceComment } from "../../types/evidence.types";

interface EvidenceCommentsProps {
  evidenceId: string;
}

export function EvidenceComments({ evidenceId }: EvidenceCommentsProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: commentsData, isLoading } = useQuery({
    queryKey: ["evidence-comments", evidenceId],
    queryFn: () => evidenceApi.getComments(evidenceId),
  });

  const createCommentMutation = useMutation({
    mutationFn: (data: {
      evidence: string;
      comment: string;
      parent?: string;
    }) => evidenceApi.createComment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["evidence-comments", evidenceId],
      });
      setNewComment("");
      setReplyText("");
      setReplyingTo(null);
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => evidenceApi.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["evidence-comments", evidenceId],
      });
    },
  });

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    createCommentMutation.mutate({
      evidence: evidenceId,
      comment: newComment,
    });
  };

  const handleSubmitReply = (parentId: string) => {
    if (!replyText.trim()) return;

    createCommentMutation.mutate({
      evidence: evidenceId,
      comment: replyText,
      parent: parentId,
    });
  };

  const renderComment = (comment: EvidenceComment, isReply = false) => {
    const canDelete = user?.id === comment.author;

    return (
      <div
        key={comment.id}
        className={`${isReply ? "ml-12 mt-3" : "mt-4"} ${!isReply ? "border-b pb-4" : ""}`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
            {getInitials(comment.author_name)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">
                {comment.author_name}
              </span>
              <span className="text-xs text-gray-500">
                {formatDateTime(comment.created_at)}
              </span>
            </div>
            <p className="text-gray-700 mt-1 whitespace-pre-wrap">
              {comment.comment}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-2">
              {!isReply && (
                <button
                  onClick={() => setReplyingTo(comment.id)}
                  className="text-sm text-gray-600 hover:text-primary"
                >
                  Reply
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => {
                    if (confirm("Delete this comment?")) {
                      deleteCommentMutation.mutate(comment.id);
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </div>

            {/* Reply Form */}
            {replyingTo === comment.id && (
              <div className="mt-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSubmitReply(comment.id)}
                    disabled={
                      !replyText.trim() || createCommentMutation.isPending
                    }
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Nested Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-3 space-y-3">
                {comment.replies.map((reply) => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const topLevelComments = commentsData?.results.filter((c) => !c.parent) || [];

  return (
    <div className="space-y-4">
      {/* New Comment Form */}
      <form onSubmit={handleSubmitComment} className="space-y-3">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!newComment.trim() || createCommentMutation.isPending}
          >
            <Send className="mr-2 h-4 w-4" />
            {createCommentMutation.isPending ? "Posting..." : "Post Comment"}
          </Button>
        </div>
      </form>

      {/* Comments List */}
      {topLevelComments.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No comments yet</p>
          <p className="text-sm text-gray-400 mt-1">Be the first to comment</p>
        </div>
      ) : (
        <div className="space-y-1">
          {topLevelComments.map((comment) => renderComment(comment))}
        </div>
      )}
    </div>
  );
}
