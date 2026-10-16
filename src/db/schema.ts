import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ── 인증 (better-auth 형식, data-model.md) ──────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    displayUsername: text("display_username"),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("name").notNull(),
    image: text("image"),
    role: text("role").notNull().default("user"),
    /** 관리자 정지: 이 시각까지 로그인할 수 없다. 영구 정지는 'infinity', 정지 아님은 null (관리자 회원 관리) */
    suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
    suspendReason: text("suspend_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("users_username_check", sql`${t.username} ~ '^[a-z0-9_]{4,20}$'`),
    check("users_role_check", sql`${t.role} in ('user', 'admin')`),
    check("users_suspend_reason_check", sql`${t.suspendReason} is null or char_length(${t.suspendReason}) between 1 and 200`),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("accounts_provider_account_unique").on(t.providerId, t.accountId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    rememberMe: boolean("remember_me").notNull().default(false),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    // 마지막 사용 시각. 유지 안 함 세션은 이 시각 2시간 뒤 무효 (AUTH-09)
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// 없는 아이디도 세므로 users와 잇지 않는다 (NF-10)
export const loginAttempts = pgTable(
  "login_attempts",
  {
    username: text("username").primaryKey(),
    failures: integer("failures").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("login_attempts_failures_check", sql`${t.failures} >= 0`)],
);

// ── 도메인 ─────────────────────────────────────────────────────────────

/**
 * 아이템 (GAME-01, SHOP-01, ERD 3.10). 지금은 기본 캐릭터 2종(남자·여자 주민)만 있다. 그림은 `art` 키로 `src/lib/art`의 도트를 고른다.
 * 행은 마이그레이션이 `code`로 넣는다.
 */
export const items = pgTable(
  "items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull().unique(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    art: text("art").notNull(),
    description: text("description").notNull().default(""),
    price: integer("price").notNull().default(0),
    // 살 수 있는 레벨 (SHOP-02)
    requiredLevel: integer("required_level").notNull().default(1),
    isStarter: boolean("is_starter").notNull().default(false),
    isOnSale: boolean("is_on_sale").notNull().default(false),
    // 성장 아이템이 동물을 키우는 양 (TOWN-09)
    growthValue: integer("growth_value"),
  },
  (t) => [
    check("items_type_check", sql`${t.type} in ('character', 'hat', 'clothes', 'accessory', 'furniture', 'background', 'growth', 'hair', 'hair_color')`),
    check("items_growth_check", sql`(${t.type} = 'growth') = (${t.growthValue} is not null) and (${t.growthValue} is null or ${t.growthValue} > 0)`),
    check("items_price_check", sql`${t.price} >= 0`),
    check("items_required_level_check", sql`${t.requiredLevel} between 1 and 99`),
    // 파는 아이템은 값이 있고 기본 아이템이 아니다 (캐릭터는 팔지 않는다, SHOP-01)
    check("items_on_sale_check", sql`not ${t.isOnSale} or (${t.price} > 0 and not ${t.isStarter} and ${t.type} <> 'character')`),
  ],
);

/** 가진 아이템 (인벤토리). 회원이 지워지면 함께 지운다 */
export const userItems = pgTable(
  "user_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
    // 가진 개수. 성장 아이템만 여러 개, 다 쓰면 행을 지운다 (TOWN-09)
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] }), index("user_items_item_idx").on(t.itemId), check("user_items_quantity_check", sql`${t.quantity} >= 1`)],
);

/**
 * 입은 아바타 아이템 (SHOP-06): 부위(모자·옷·소품 = 아이템 종류)마다 하나. 가진 것만 (복합 외래 키).
 * 회원이 지워지면 함께 지운다.
 */
export const avatarEquips = pgTable(
  "avatar_equips",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(),
    itemId: integer("item_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.slot] }),
    check("avatar_equips_slot_check", sql`${t.slot} in ('hat', 'clothes', 'accessory', 'hair', 'hair_color')`),
    foreignKey({
      name: "avatar_equips_owned_fk",
      columns: [t.userId, t.itemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }).onDelete("cascade"),
  ],
);

/**
 * 우리 집 가구 (SHOP-05): 칸(0~7)마다 가구 하나, 가구 하나는 한 칸에만. 가진 가구만 (복합 외래 키).
 * 열린 칸 수는 집 단계로 정한다 (src/lib/house.ts). 회원이 지워지면 함께 지운다.
 */
export const houseFurniture = pgTable(
  "house_furniture",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    itemId: integer("item_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.slot] }),
    unique("house_furniture_item_uq").on(t.userId, t.itemId),
    check("house_furniture_slot_check", sql`${t.slot} between 0 and 7`),
    foreignKey({
      name: "house_furniture_owned_fk",
      columns: [t.userId, t.itemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }).onDelete("cascade"),
  ],
);

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull().unique(),
    // 프로필 사진 (BLOG-03·04): 내가 올린 첨부(사진) 하나. 첨부가 지워지면 비운다. 한 첨부는 한 프로필에만
    photoKey: text("photo_key")
      .unique()
      .references((): AnyPgColumn => attachments.key, { onDelete: "set null" }),
    // 장착한 캐릭터 (GAME-01): 가진 캐릭터만 (복합 외래 키)
    characterItemId: integer("character_item_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "profiles_nickname_check",
      sql`char_length(${t.nickname}) between 2 and 20 and ${t.nickname} = btrim(${t.nickname})`,
    ),
    foreignKey({
      name: "profiles_character_owned_fk",
      columns: [t.userId, t.characterItemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }),
  ],
);

export const blogs = pgTable(
  "blogs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    intro: text("intro").notNull().default(""),
    // 미니룸 배경 (SHOP-04): 가진 배경만 (복합 외래 키)
    backgroundItemId: integer("background_item_id"),
    // 마을의 내 집 지붕 색 (TOWN-07). NULL이면 이 블로그 색 순서의 첫 색 (src/lib/roof.ts)
    roofColor: text("roof_color"),
    // 블로그 강조색 (src/lib/blog-accent.ts). NULL이면 기본 초록
    accentColor: text("accent_color"),
    // 글 목록 모양 (src/lib/list-style.ts). NULL이면 카드형
    listStyle: text("list_style"),
    // 블로그 홈 맨 위 커버 사진의 첨부 키 (블로그 꾸미기). NULL이면 없음
    coverKey: text("cover_key"),
    // 옆 칸 위젯 순서·보이기·크기 (src/lib/widgets.ts layoutOf로 읽는다). NULL이면 기본 배치
    widgetLayout: jsonb("widget_layout"),
    // ☀️ 날씨 위젯의 도시 (src/lib/weather.ts WEATHER_CITIES의 key). NULL이면 서울
    weatherCity: text("weather_city"),
    // ☀️ 날씨 위젯의 동네 (주인이 검색해 고른 행정동, "광주 서구 상무1동"). 좌표는 0.01도로 줄여 둔다. NULL이면 weatherCity
    weatherPlace: text("weather_place"),
    weatherLat: doublePrecision("weather_lat"),
    weatherLon: doublePrecision("weather_lon"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("blogs_owner_id_unique").on(t.ownerId),
    foreignKey({
      name: "blogs_background_owned_fk",
      columns: [t.ownerId, t.backgroundItemId],
      foreignColumns: [userItems.userId, userItems.itemId],
    }),
    check("blogs_slug_check", sql`${t.slug} ~ '^[a-z0-9_]{3,20}$'`),
    check(
      "blogs_title_check",
      sql`char_length(${t.title}) between 1 and 40 and ${t.title} = btrim(${t.title})`,
    ),
    check("blogs_intro_check", sql`char_length(${t.intro}) <= 160`),
    check("blogs_list_style_check", sql`${t.listStyle} in ('list', 'gallery')`),
    check("blogs_accent_color_check", sql`${t.accentColor} in ('green', 'blue', 'purple', 'pink', 'orange', 'gray')`),
    check(
      "blogs_weather_place_check",
      sql`(${t.weatherPlace} is null) = (${t.weatherLat} is null) and (${t.weatherPlace} is null) = (${t.weatherLon} is null) and (${t.weatherPlace} is null or (char_length(${t.weatherPlace}) between 1 and 60 and ${t.weatherLat} between 33 and 39 and ${t.weatherLon} between 124 and 132))`,
    ),
    check(
      "blogs_roof_color_check",
      sql`${t.roofColor} in ('red', 'orange', 'yellow', 'green', 'sky', 'blue', 'purple', 'brown', 'pink', 'mint')`,
    ),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("categories_blog_name_unique").on(t.blogId, t.name),
    // posts의 복합 FK가 가리킨다 (내 블로그 대분류만)
    unique("categories_id_blog_unique").on(t.id, t.blogId),
    check("categories_name_check", sql`char_length(${t.name}) between 1 and 20`),
  ],
);

// 시리즈 (개선 12): 블로그 안의 연재 묶음. 글 순서는 글 날짜순
export const series = pgTable(
  "series",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("series_blog_title_unique").on(t.blogId, t.title),
    check("series_title_check", sql`char_length(${t.title}) between 1 and 40 and ${t.title} = btrim(${t.title})`),
  ],
);

export const subcategories = pgTable(
  "subcategories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("subcategories_category_name_unique").on(t.categoryId, t.name),
    unique("subcategories_id_category_unique").on(t.id, t.categoryId),
    check("subcategories_name_check", sql`char_length(${t.name}) between 1 and 20`),
  ],
);

// category_id·subcategory_id의 복합 FK(ON DELETE SET NULL (컬럼))는
// drizzle이 표현하지 못해 drizzle/0001_post_category_fks.sql에 직접 적는다.
export const posts = pgTable(
  "posts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    categoryId: integer("category_id"),
    subcategoryId: integer("subcategory_id"),
    title: text("title").notNull(),
    contentHtml: text("content_html").notNull(),
    contentText: text("content_text").notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    /** 관리자 블라인드: 가린 글은 비공개로만 둘 수 있다 (작성자만 봄). 풀면 null (관리자 글 관리) */
    blindedAt: timestamp("blinded_at", { withTimezone: true }),
    blindReason: text("blind_reason"),
    /** post_views에서 셀 수 있는 합계를 일부러 저장한 값 (POST-06) */
    viewCount: integer("view_count").notNull().default(0),
    /** 시리즈 (개선 12): 연재 묶음. 같은 블로그의 시리즈만 (서버가 확인). 시리즈를 지우면 null */
    seriesId: integer("series_id").references(() => series.id, { onDelete: "set null" }),
    /** 예약 발행 (개선 11): 이 시각이 되면 공개로 바뀐다. 기다리는 동안은 비공개(작성자만 봄). 공개되면 null */
    publishAt: timestamp("publish_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("posts_series_idx").on(t.seriesId, t.createdAt, t.id).where(sql`${t.seriesId} is not null`),
    index("posts_publish_at_idx").on(t.publishAt).where(sql`${t.publishAt} is not null`),
    check("posts_scheduled_private", sql`${t.publishAt} is null or not ${t.isPublic}`),
    index("posts_blog_list_idx").on(t.blogId, t.createdAt, t.id),
    // 마을 소식·인기 글 기간 후보처럼 모든 블로그의 글을 최신순으로 몇 개만 읽을 때 (성능 개선 0051).
    // is_public은 질의에서 $1로 넘어가 준비된 질의의 일반 계획이 부분 색인을 못 쓰므로 조건 없이 둔다.
    // 색인은 모두 오름차순으로 둔다: 드리즐 .desc() 색인은 NULLS LAST라 "order by … desc"(NULLS FIRST)에 안 맞아 못 쓴다.
    // 오름차순 색인은 거꾸로 읽어 desc 정렬에 그대로 쓰인다 (0051)
    index("posts_recent_idx").on(t.createdAt, t.id),
    index("posts_blog_popular_idx").on(t.blogId, t.viewCount),
    check("posts_view_count_check", sql`${t.viewCount} >= 0`),
    index("posts_category_idx").on(t.categoryId),
    index("posts_subcategory_idx").on(t.subcategoryId),
    check("posts_title_check", sql`char_length(${t.title}) between 1 and 100`),
    check("posts_content_html_check", sql`char_length(${t.contentHtml}) <= 200000`),
    check("posts_content_text_check", sql`char_length(btrim(${t.contentText})) >= 1`),
    check(
      "posts_subcategory_needs_category",
      sql`${t.subcategoryId} is null or ${t.categoryId} is not null`,
    ),
    check("posts_blinded_private", sql`${t.blindedAt} is null or not ${t.isPublic}`),
    check("posts_blind_reason_check", sql`${t.blindReason} is null or char_length(${t.blindReason}) between 1 and 200`),
  ],
);

// 사진·파일 첨부 (POST-07·09, specs/002-attachments/data-model.md).
// detached_at은 트리거가 관리한다 (drizzle/0003_attachments_track_detached.sql).
export const attachments = pgTable(
  "attachments",
  {
    key: text("key").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"image" | "file">().notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    postId: integer("post_id").references(() => posts.id, { onDelete: "set null" }),
    detachedAt: timestamp("detached_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("attachments_user_created_idx").on(t.userId, t.createdAt),
    index("attachments_post_id_idx").on(t.postId),
    index("attachments_unlinked_idx").on(t.createdAt).where(sql`${t.postId} is null`),
    check("attachments_key_check", sql`${t.key} ~ '^[0-9a-f]{32}$'`),
    check("attachments_kind_check", sql`${t.kind} in ('image', 'file')`),
    check("attachments_name_check", sql`char_length(${t.name}) between 1 and 255`),
    check("attachments_size_check", sql`${t.size} > 0`),
  ],
);

// 태그 (POST-04, specs/003-tags/data-model.md)
export const tags = pgTable("tags", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

export const postTags = pgTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index("post_tags_tag_idx").on(t.tagId)],
);

// 댓글과 답글 (SOC-01·02, specs/004-comments/data-model.md).
// 삭제는 행을 지우지 않고 내용을 비운 자리로 남긴다.
const liveContentCheck = (name: string, content: AnyPgColumn, deletedAt: AnyPgColumn) =>
  check(
    name,
    sql`(${deletedAt} is null and char_length(${content}) between 1 and 1000) or (${deletedAt} is not null and ${content} = '')`,
  );

export const comments = pgTable(
  "comments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    /** 비밀 댓글: 작성자·블로그 주인·관리자만 내용을 본다 (specs/055-comment-edit-secret) */
    isSecret: boolean("is_secret").notNull().default(false),
    /** 작성자가 내용을 마지막으로 고친 시각. 고친 적 없으면 null (`(수정됨)`) */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("comments_post_created_idx").on(t.postId, t.createdAt),
    // 인기 글: 기간 안에 달린 댓글만 세려고 (0051)
    index("comments_created_idx").on(t.createdAt).where(sql`${t.deletedAt} is null`),
    liveContentCheck("comments_content_check", t.content, t.deletedAt),
  ],
);

// 답글은 댓글만 가리켜서 답글의 답글은 구조상 만들 수 없다 (1단계)
export const replies = pgTable(
  "replies",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    commentId: integer("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    /** 비밀 답글: 작성자·원댓글 작성자·블로그 주인·관리자만 내용을 본다 */
    isSecret: boolean("is_secret").notNull().default(false),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("replies_comment_created_idx").on(t.commentId, t.createdAt),
    liveContentCheck("replies_content_check", t.content, t.deletedAt),
  ],
);

// 방명록 (BLOG-10, specs/056-guestbook). 블로그마다 회원이 남기는 한마디와 블로그 주인의 답글 1개.
// 답글은 따로 표 없이 그 줄의 `reply`에 둔다 (1단계, 주인만). 지우면 행을 지운다: 답글도 함께 사라진다.
// 작성자가 탈퇴하면 그 회원의 방명록 글도 지워진다 (ON DELETE CASCADE). 블로그가 지워지면 함께 지워진다.
export const guestbookEntries = pgTable(
  "guestbook_entries",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    /** 비밀 방명록: 작성자·블로그 주인·관리자만 내용을 본다 (답글도 같다) */
    isSecret: boolean("is_secret").notNull().default(false),
    /** 작성자가 내용을 마지막으로 고친 시각 (`(수정됨)`) */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    /** 블로그 주인의 답글. 없으면 null */
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    replyEditedAt: timestamp("reply_edited_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("guestbook_entries_blog_created_idx").on(t.blogId, t.createdAt, t.id),
    index("guestbook_entries_author_idx").on(t.authorId),
    check("guestbook_entries_content_check", sql`char_length(${t.content}) between 1 and 1000`),
    check(
      "guestbook_entries_reply_check",
      sql`(${t.reply} is null and ${t.repliedAt} is null and ${t.replyEditedAt} is null) or (${t.reply} is not null and char_length(${t.reply}) between 1 and 1000 and ${t.repliedAt} is not null)`,
    ),
  ],
);

// 버그·문의 (SUP-02~04, specs/057-support). 회원이 보낸 버그 신고·문의와 관리자·자동 처리(bot)의 답변.
// 쓴 사람이 탈퇴하면 함께 지워진다. 답변(reply)·답변 시각·누가 답했는지는 같이 있거나 같이 없다 (feedback_reply_check).
export const feedback = pgTable(
  "feedback",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"bug" | "question">().notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    /** 문의를 쓰기 전에 보던 이 사이트 안의 주소 (`?from=`). 없으면 null */
    pagePath: text("page_path"),
    /** 서버가 요청 헤더에서 받은 브라우저 정보 (300자까지) */
    userAgent: text("user_agent"),
    status: text("status").$type<"new" | "in_progress" | "answered" | "fixed">().notNull().default("new"),
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    repliedBy: text("replied_by").$type<"admin" | "bot">(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("feedback_status_created_idx").on(t.status, t.createdAt),
    index("feedback_user_created_idx").on(t.userId, t.createdAt),
    check("feedback_kind_check", sql`${t.kind} in ('bug', 'question')`),
    check("feedback_status_check", sql`${t.status} in ('new', 'in_progress', 'answered', 'fixed')`),
    check("feedback_title_check", sql`char_length(${t.title}) between 1 and 100`),
    check("feedback_content_check", sql`char_length(${t.content}) between 1 and 2000`),
    check("feedback_page_path_check", sql`${t.pagePath} is null or char_length(${t.pagePath}) between 1 and 2048`),
    check("feedback_user_agent_check", sql`${t.userAgent} is null or char_length(${t.userAgent}) between 1 and 300`),
    check(
      "feedback_reply_check",
      sql`(${t.reply} is null and ${t.repliedAt} is null and ${t.repliedBy} is null) or (${t.reply} is not null and char_length(${t.reply}) between 1 and 2000 and ${t.repliedAt} is not null and ${t.repliedBy} in ('admin', 'bot'))`,
    ),
  ],
);

// 조회수·방문자 (POST-06, BLOG-06, specs/005-blog-sidebar/data-model.md).
// 기본 키가 "같은 브라우저는 하루 1번"을 보장한다. 날짜는 한국 날짜, IP·회원 ID는 저장하지 않는다.
export const postViews = pgTable(
  "post_views",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    visitorId: uuid("visitor_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.date, t.visitorId] })],
);

export const blogVisits = pgTable(
  "blog_visits",
  {
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    visitorId: uuid("visitor_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.blogId, t.date, t.visitorId] })],
);

// 글 유입 경로 (개선: 통계 상세). 글을 그날 처음 본 방문자가 어디서 왔는지 날짜·출처별로 센다.
// 출처는 주소 전체가 아니라 사이트 이름(naver·google…)이나 호스트만 남긴다.
export const blogReferrers = pgTable(
  "blog_referrers",
  {
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    source: text("source").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.blogId, t.date, t.source] }),
    check("blog_referrers_source_check", sql`char_length(${t.source}) between 1 and 60`),
    check("blog_referrers_count_check", sql`${t.count} >= 0`),
  ],
);

// 공감 (SOC-03). 기본 키가 "한 글에 한 번"을 지킨다.
export const postLikes = pgTable(
  "post_likes",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] }), index("post_likes_user_idx").on(t.userId), index("post_likes_created_idx").on(t.createdAt)],
);

// 이웃 (SOC-04). 기본 키가 "같은 이웃은 한 번만"을, CHECK가 "나는 내 이웃이 아님"을 지킨다.
// is_favorite: 즐겨찾는 이웃 ⭐ (TOWN-08, 최대 10명은 서버가 회원별 잠금으로 지킨다). 이웃을 취소하면 행과 함께 풀린다.
// town_lot: 그 이웃의 집이 설 내 마을 자리 1~10 (TOWN-18). 즐겨찾기일 때만, 회원마다 자리 하나에 한 이웃. ⭐를 끄면 비운다.
export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isFavorite: boolean("is_favorite").notNull().default(false),
    townLot: smallint("town_lot"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index("follows_followee_idx").on(t.followeeId),
    check("follows_not_self_check", sql`${t.followerId} <> ${t.followeeId}`),
    check("follows_town_lot_check", sql`${t.townLot} is null or (${t.townLot} between 1 and 10 and ${t.isFavorite})`),
    uniqueIndex("follows_town_lot_uq").on(t.followerId, t.townLot).where(sql`${t.townLot} is not null`),
  ],
);

// 블로그 관심 종목 (📈 위젯). 블로그 주인이 넣고 빼며, 방문자도 시세를 본다. 블로그마다 최대 10개(서버가 블로그 행 잠금으로 지킨다).
// code: 국내는 6자리 종목 코드, 미국은 네이버 증권의 로이터 코드(AAPL.O 등). market: KR·US
export const blogStocks = pgTable(
  "blog_stocks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    market: text("market").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    // 옆 칸·설정에 보이는 순서 (작은 것부터, 주인이 ▲▼·끌어 놓기로 바꾼다)
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("blog_stocks_blog_code_uq").on(t.blogId, t.market, t.code),
    check("blog_stocks_market_check", sql`${t.market} in ('KR', 'US')`),
    check("blog_stocks_name_check", sql`char_length(${t.name}) between 1 and 60`),
  ],
);

export type Blog = typeof blogs.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;

// 알림 (GAME-08의 공감·댓글·답글, specs/017-notifications · GAME-06 레벨업, specs/034-level-up).
// 닉네임·글 제목은 저장하지 않고 보여 줄 때 JOIN한다. 받는 사람·행동한 사람·글이 지워지면 함께 지워진다.
// 레벨업은 행동한 사람·글이 없고 `level`만 있다 (notifications_shape_check).
// 방명록 알림(BLOG-10)은 글 대신 방명록 글(`guestbook_entry_id`)이 있다.
// 문의 답변 알림(SUP-03·04)은 행동한 사람 없이 문의(`feedback_id`)만 있다 (관리자·자동 처리가 답한다).
// 이웃 새 글 알림(new_post)은 공감·댓글처럼 행동한 사람(글쓴이)과 글이 있다.
export const notifications = pgTable(
  "notifications",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "cascade" }),
    postId: integer("post_id").references(() => posts.id, { onDelete: "cascade" }),
    /** 방명록 알림의 그 방명록 글 (BLOG-10). 글이 지워지면 알림도 지워진다 */
    guestbookEntryId: integer("guestbook_entry_id").references(() => guestbookEntries.id, { onDelete: "cascade" }),
    /** 문의 답변 알림의 그 문의 (SUP-03·04). 문의가 지워지면 알림도 지워진다 */
    feedbackId: integer("feedback_id").references(() => feedback.id, { onDelete: "cascade" }),
    level: integer("level"),
    createdAt: createdAt(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt, t.id),
    index("notifications_unread_idx").on(t.userId).where(sql`${t.readAt} is null`),
    index("notifications_post_idx").on(t.postId),
    index("notifications_actor_idx").on(t.actorId),
    index("notifications_guestbook_entry_idx").on(t.guestbookEntryId),
    index("notifications_feedback_idx").on(t.feedbackId),
    // 공감 알림은 같은 사람·같은 글에 한 번만 (껐다 켜도, 동시에 눌러도)
    uniqueIndex("notifications_like_uq").on(t.userId, t.actorId, t.postId).where(sql`${t.kind} = 'like'`),
    // 같은 레벨 알림은 한 번만 (GAME-06)
    uniqueIndex("notifications_level_up_uq").on(t.userId, t.level).where(sql`${t.kind} = 'level_up'`),
    check("notifications_kind_check", sql`${t.kind} in ('like', 'comment', 'reply', 'level_up', 'guestbook', 'guestbook_reply', 'feedback_reply', 'new_post')`),
    check("notifications_not_self_check", sql`${t.actorId} is null or ${t.userId} <> ${t.actorId}`),
    check(
      "notifications_shape_check",
      sql`(${t.kind} = 'level_up' and ${t.actorId} is null and ${t.postId} is null and ${t.guestbookEntryId} is null and ${t.feedbackId} is null and ${t.level} between 2 and 99) or (${t.kind} in ('like', 'comment', 'reply', 'new_post') and ${t.actorId} is not null and ${t.postId} is not null and ${t.guestbookEntryId} is null and ${t.feedbackId} is null and ${t.level} is null) or (${t.kind} in ('guestbook', 'guestbook_reply') and ${t.actorId} is not null and ${t.postId} is null and ${t.guestbookEntryId} is not null and ${t.feedbackId} is null and ${t.level} is null) or (${t.kind} = 'feedback_reply' and ${t.actorId} is null and ${t.postId} is null and ${t.guestbookEntryId} is null and ${t.feedbackId} is not null and ${t.level} is null)`,
    ),
  ],
);

// 알림 설정 (🔔 내 정보): 회원이 끈 알림 종류. 행이 없으면 모두 켜짐이다.
// 문의 답변 알림(feedback_reply)은 끌 수 없어 칸이 없다. 방명록 칸은 방명록 글·방명록 답글 알림을 함께 다룬다.
export const notificationPrefs = pgTable("notification_prefs", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  like: boolean("like").notNull().default(true),
  comment: boolean("comment").notNull().default(true),
  reply: boolean("reply").notNull().default(true),
  guestbook: boolean("guestbook").notNull().default(true),
  newPost: boolean("new_post").notNull().default(true),
  levelUp: boolean("level_up").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 경험치·코인 원장 (GAME-02·03·05, ERD 3.5). 레벨·잔액 컬럼은 없고 합계로만 계산한다.
 * `ref_id`는 무엇으로 받았는지(글 ID 등) 남기는 글자이고 외래 키가 아니다. 글을 지워도 받은 보상은 그대로다.
 */
export const pointLedger = pgTable(
  "point_ledger",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    expDelta: integer("exp_delta").notNull().default(0),
    coinDelta: integer("coin_delta").notNull().default(0),
    refId: text("ref_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("point_ledger_user_reason_created_idx").on(t.userId, t.reason, t.createdAt),
    index("point_ledger_user_created_idx").on(t.userId, t.createdAt, t.id),
    // 같은 사람·같은 글 공감 보상은 한 번만 (껐다 켜도, 동시에 눌러도)
    uniqueIndex("point_ledger_like_received_uq").on(t.userId, t.refId).where(sql`${t.reason} = 'like_received'`),
    // 가입 축하는 한 번만
    uniqueIndex("point_ledger_signup_uq").on(t.userId).where(sql`${t.reason} = 'signup'`),
    // 출석 보상은 하루 한 번 (ref_id = 날짜)
    uniqueIndex("point_ledger_attendance_uq").on(t.userId, t.refId).where(sql`${t.reason} = 'attendance'`),
    // 같은 아이템은 한 번만 산다 (SHOP-01, ref_id = 아이템 ID)
    uniqueIndex("point_ledger_purchase_uq").on(t.userId, t.refId).where(sql`${t.reason} = 'purchase'`),
    // 다 키운 동물 보상·산 알은 동물마다 한 번 (TOWN-09, ref_id = 동물 ID)
    uniqueIndex("point_ledger_farm_uq").on(t.userId, t.reason, t.refId).where(sql`${t.reason} in ('farm_grown', 'egg_purchase')`),
    // 낚시는 하루 한 번 (TOWN-14, ref_id = 날짜)
    uniqueIndex("point_ledger_fishing_uq").on(t.userId, t.refId).where(sql`${t.reason} = 'fishing'`),
    check(
      "point_ledger_reason_check",
      sql`${t.reason} in ('signup', 'attendance', 'post', 'comment', 'like_received', 'purchase', 'farm_care', 'farm_grown', 'egg_purchase', 'growth_purchase', 'fishing', 'admin_grant')`,
    ),
    // 구매(상점·알)만 코인이 줄고, 구매는 경험치가 없다 (SHOP-03, TOWN-09)
    check(
      "point_ledger_purchase_check",
      sql`(${t.reason} in ('purchase', 'egg_purchase', 'growth_purchase')) = (${t.coinDelta} < 0) and (${t.reason} not in ('purchase', 'egg_purchase', 'growth_purchase') or ${t.expDelta} = 0)`,
    ),
    check("point_ledger_exp_check", sql`${t.expDelta} >= 0`),
    check("point_ledger_nonzero_check", sql`${t.expDelta} <> 0 or ${t.coinDelta} <> 0`),
  ],
);

/** 출석 일차별 보상 (GAME-04, ERD 3.12). 숫자는 이 표만 고친다 (데이터 마이그레이션) */
export const attendanceRewards = pgTable(
  "attendance_rewards",
  {
    day: integer("day").primaryKey(),
    exp: integer("exp").notNull(),
    coins: integer("coins").notNull(),
  },
  (t) => [
    check("attendance_rewards_day_check", sql`${t.day} between 1 and 7`),
    check("attendance_rewards_amount_check", sql`${t.exp} >= 0 and ${t.coins} >= 0 and (${t.exp} > 0 or ${t.coins} > 0)`),
  ],
);

/** 출석 (GAME-04): 회원·한국 날짜마다 한 줄. 로그인 세션이 지워져도 출석은 남는다 */
export const attendances = pgTable(
  "attendances",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    cycleDay: integer("cycle_day")
      .notNull()
      .references(() => attendanceRewards.day),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    index("attendances_session_idx").on(t.sessionId),
    check("attendances_cycle_day_check", sql`${t.cycleDay} between 1 and 7`),
  ],
);

/**
 * 농장의 알과 동물 (TOWN-09, specs/044-farm). `species`가 NULL이면 아직 알이다.
 * 알을 얻은 길(`source`): 첫 알·레벨 보상 알은 회원당 한 번(부분 고유 인덱스), 산 알은 몇 번이든.
 * 다 자라면 `grown_at`이 찍히고 키우는 자리(5마리)에서 빠져 카드가 된다.
 */
export const animals = pgTable(
  "animals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    species: text("species"),
    source: text("source").notNull(),
    sourceLevel: integer("source_level"),
    growth: integer("growth").notNull().default(0),
    hatchedAt: timestamp("hatched_at", { withTimezone: true }),
    grownAt: timestamp("grown_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("animals_user_idx").on(t.userId, t.grownAt),
    uniqueIndex("animals_first_egg_uq").on(t.userId).where(sql`${t.source} = 'first'`),
    uniqueIndex("animals_level_egg_uq").on(t.userId, t.sourceLevel).where(sql`${t.source} = 'level'`),
    check("animals_species_check", sql`${t.species} in ('chick', 'rabbit', 'piglet', 'calf')`),
    check("animals_source_check", sql`${t.source} in ('first', 'level', 'buy') and (${t.source} = 'level') = (${t.sourceLevel} is not null) and (${t.sourceLevel} is null or (${t.sourceLevel} > 0 and ${t.sourceLevel} % 5 = 0))`),
    // 알은 자라지 않고 부화 시각이 없다. 다 자란 것은 부화한 동물만
    check("animals_egg_check", sql`(${t.species} is null) = (${t.hatchedAt} is null) and (${t.species} is not null or (${t.growth} = 0 and ${t.grownAt} is null))`),
    check("animals_growth_check", sql`${t.growth} >= 0`),
  ],
);

/** 하루 한 번씩 하는 돌보기 (TOWN-09): 동물·돌보기·한국 날짜마다 한 줄 */
export const animalCares = pgTable(
  "animal_cares",
  {
    animalId: integer("animal_id")
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    date: date("date").notNull(),
  },
  (t) => [primaryKey({ columns: [t.animalId, t.action, t.date] }), check("animal_cares_action_check", sql`${t.action} in ('feed', 'water', 'pet')`)],
);

/** 낚시 기록 (TOWN-14): 회원·한국 날짜마다 한 번 */
export const fishingCatches = pgTable(
  "fishing_catches",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    catch: text("catch").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    check("fishing_catches_catch_check", sql`${t.catch} in ('minnow', 'crucian', 'carp', 'golden_carp', 'feed', 'boot')`),
  ],
);

/**
 * 관리 기록 (ADM-06): 관리자가 회원·콘텐츠·사이트 설정을 바꾼 일. 지우지 않는다.
 * 대상은 종류(target_type)·ID(target_id)와 사람이 읽는 이름(target_label: 아이디·글 제목 등)으로 남겨, 대상이 지워져도 무엇이었는지 보인다.
 * 관리자가 탈퇴하면 admin_id만 비운다.
 */
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    adminId: text("admin_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").$type<"member" | "post" | "comment" | "reply" | "guestbook" | "feedback" | "site">().notNull(),
    targetId: text("target_id"),
    targetLabel: text("target_label").notNull(),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [
    index("admin_audit_created_idx").on(t.createdAt, t.id),
    index("admin_audit_action_created_idx").on(t.action, t.createdAt),
    check("admin_audit_action_check", sql`char_length(${t.action}) between 1 and 40`),
    check("admin_audit_target_type_check", sql`${t.targetType} in ('member', 'post', 'comment', 'reply', 'guestbook', 'feedback', 'site')`),
    check("admin_audit_target_id_check", sql`${t.targetId} is null or char_length(${t.targetId}) between 1 and 64`),
    check("admin_audit_target_label_check", sql`char_length(${t.targetLabel}) between 1 and 200`),
    check("admin_audit_detail_check", sql`${t.detail} is null or char_length(${t.detail}) <= 1000`),
  ],
);

/**
 * 사이트 설정 (ADM-04·05): 키 하나에 값 하나.
 * `notice`: 사이트 공지 띠 (JSON {text, link, enabled}), `banned_words`: 금지어 (한 줄에 하나).
 * 값이 바뀐 시각(updated_at)은 공지 띠의 판(닫기 기억 키)으로도 쓴다.
 */
export const siteSettings = pgTable(
  "site_settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [check("site_settings_value_check", sql`char_length(${t.value}) <= 10000`)],
);

// 신고 (specs/059-report-bookmarks). 회원이 글·댓글·답글·방명록을 신고하고 관리자가 처리한다.
// 대상은 종류+ID로만 가리킨다 (외래 키 없음): 대상이 지워져도 신고는 남아 관리자가 정리한다.
// 한 회원은 한 대상을 한 번만 신고한다 (reports_reporter_target_unique). 처리(resolved·dismissed)하면 처리한 관리자·시각이 함께 남는다.
export const reports = pgTable(
  "reports",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").$type<"post" | "comment" | "reply" | "guestbook">().notNull(),
    targetId: integer("target_id").notNull(),
    reason: text("reason").$type<"spam" | "abuse" | "obscene" | "privacy" | "other">().notNull(),
    /** 기타일 때 쓰는 설명 (1~300자). 다른 사유면 null */
    detail: text("detail"),
    status: text("status").$type<"open" | "resolved" | "dismissed">().notNull().default("open"),
    resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("reports_reporter_target_unique").on(t.reporterId, t.targetType, t.targetId),
    index("reports_status_created_idx").on(t.status, t.createdAt),
    index("reports_target_idx").on(t.targetType, t.targetId),
    index("reports_reporter_created_idx").on(t.reporterId, t.createdAt),
    check("reports_target_type_check", sql`${t.targetType} in ('post', 'comment', 'reply', 'guestbook')`),
    check("reports_reason_check", sql`${t.reason} in ('spam', 'abuse', 'obscene', 'privacy', 'other')`),
    check(
      "reports_detail_check",
      sql`(${t.reason} = 'other' and ${t.detail} is not null and char_length(${t.detail}) between 1 and 300) or (${t.reason} <> 'other' and ${t.detail} is null)`,
    ),
    check("reports_status_check", sql`${t.status} in ('open', 'resolved', 'dismissed')`),
    check("reports_resolved_check", sql`(${t.status} = 'open') = (${t.resolvedAt} is null)`),
  ],
);

// 스크랩 (나중에 읽기, specs/059-report-bookmarks). 기본 키가 "한 글에 한 번"을 지킨다.
// 남의 비공개 글은 스크랩할 수 없고, 스크랩한 글이 비공개가 되면 목록에서 빠진다 (읽을 때 거른다).
export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index("bookmarks_user_created_idx").on(t.userId, t.createdAt), index("bookmarks_post_idx").on(t.postId)],
);

// 서버 오류 기록 (instrumentation.ts의 onRequestError, server/error-log.ts).
// 같은 오류(digest, 없으면 메시지)·같은 경로가 1시간 안에 또 나면 새 줄 대신 count·last_seen_at만 올린다.
// 30일 지난 줄은 기록할 때 가끔(1%) 지운다. 쿼리 문자열·환경 값은 남기지 않는다.
export const errorLogs = pgTable(
  "error_logs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    digest: text("digest"),
    message: text("message").notNull(),
    stack: text("stack"),
    routePath: text("route_path"),
    routeType: text("route_type"),
    method: text("method"),
    /** 경로만 (쿼리 문자열 없이) */
    url: text("url"),
    userAgent: text("user_agent"),
    count: integer("count").notNull().default(1),
  },
  (t) => [
    index("error_logs_last_seen_idx").on(t.lastSeenAt),
    index("error_logs_group_idx").on(t.routePath, t.digest, t.lastSeenAt),
    check("error_logs_message_check", sql`char_length(${t.message}) <= 1000`),
    check("error_logs_stack_check", sql`${t.stack} is null or char_length(${t.stack}) <= 4000`),
    check("error_logs_user_agent_check", sql`${t.userAgent} is null or char_length(${t.userAgent}) <= 300`),
    check("error_logs_count_check", sql`${t.count} >= 1`),
  ],
);

// 🍽 맛집의 ⭐ 가고 싶은 곳. 식당은 카카오·네이버에서 그때그때 찾으므로 저장할 때의 정보를 그대로 적어 둔다.
// place_id는 FoodPlace.id (카카오 장소 id 또는 네이버 이름+주소 키). 한 회원은 한 곳을 한 번만 저장한다.
export const foodSaved = pgTable(
  "food_saved",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: text("place_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default(""),
    address: text("address").notNull().default(""),
    phone: text("phone").notNull().default(""),
    mapUrl: text("map_url").notNull().default(""),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("food_saved_user_place_unique").on(t.userId, t.placeId),
    index("food_saved_user_created_idx").on(t.userId, t.createdAt),
    check("food_saved_place_id_check", sql`char_length(${t.placeId}) between 1 and 200`),
    check("food_saved_name_check", sql`char_length(${t.name}) between 1 and 100`),
  ],
);
