const AVATAR_COLORS = [
  "bg-blue-500 text-white",
  "bg-green-500 text-white",
  "bg-purple-500 text-white",
  "bg-orange-500 text-white",
  "bg-pink-500 text-white",
  "bg-teal-500 text-white",
  "bg-sky-500 text-white",
  "bg-red-500 text-white",
];

/**
 * Single-letter avatar fallback shared by `NavigationSidebar.vue`'s trigger
 * and `ProfileModal.vue`'s header — deliberately distinct from
 * `getInitials()` below (first+last initials) so existing two-letter
 * avatars elsewhere in the app are unaffected.
 */
export function getInitial(name: string | null | undefined): string {
  const label = name?.trim() ?? "";
  return label ? label.charAt(0).toUpperCase() : "?";
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[parts.length - 1])
    return (
      parts[0].charAt(0) + parts[parts.length - 1]!.charAt(0)
    ).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return (
    AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ??
    "bg-blue-500 text-white"
  );
}
