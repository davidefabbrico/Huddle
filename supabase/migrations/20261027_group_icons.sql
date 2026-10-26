-- =============================================================================
-- Huddle — update of 27/10/2026: group icons (emoji + color)
-- For a Supabase project that already ran supabase/schema.sql BEFORE this date:
-- SQL Editor -> paste -> Run (once). New projects don't need it: schema.sql already has these columns.
-- The values must match lib/groupIcons.ts.
-- =============================================================================

alter table public.groups
  add column if not exists icon text,
  add column if not exists color text;

alter table public.groups drop constraint if exists groups_icon_check;
alter table public.groups add constraint groups_icon_check check (icon is null or icon = any (array[
      '⚽', '🏀', '🏐', '🎾', '🏓', '🏸', '⛳', '🥊', '⛷️', '🏂', '🚴', '🏃',
      '🧗', '🏊', '🧘', '🏋️', '🛹', '🛶', '⛰️', '🥾', '🏕️', '🌊', '🌿', '🌻',
      '🐶', '🐱', '🎣', '🚲', '📚', '✍️', '🎭', '🎨', '🎬', '📷', '🏛️', '🗣️',
      '🧠', '🌍', '🎧', '🎸', '🎹', '🎤', '🥁', '🎷', '🎻', '🎶', '💻', '📱',
      '🤖', '🎮', '🎲', '♟️', '🧩', '🚀', '🍕', '🍝', '🍣', '🍔', '☕', '🍷',
      '🍻', '🥂', '🍰', '🍳', '✈️', '🚗', '🚆', '🏖️', '🗺️', '🏙️', '👥', '💬',
      '❤️', '🎉', '⭐', '🌈', '🔥', '🍀'
  ]));

alter table public.groups drop constraint if exists groups_color_check;
alter table public.groups add constraint groups_color_check check (color is null or color in ('orange', 'rose', 'violet', 'sky', 'teal', 'green', 'amber', 'slate'));
