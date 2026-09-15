const autoReviewKeys = new Set<string>();

export function wasAutoReviewed(key: string) {
  return autoReviewKeys.has(key);
}

export function markAutoReviewed(key: string) {
  autoReviewKeys.add(key);
}

export function resetAutoReviewKeys() {
  autoReviewKeys.clear();
}
