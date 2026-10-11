import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("users_username_check", sql`${t.username} ~ '^[a-z0-9_]{4,20}$'`),
    check("users_role_check", sql`${t.role} in ('user', 'admin')`),
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

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "profiles_nickname_check",
      sql`char_length(${t.nickname}) between 2 and 20 and ${t.nickname} = btrim(${t.nickname})`,
    ),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("blogs_owner_id_unique").on(t.ownerId),
    check("blogs_slug_check", sql`${t.slug} ~ '^[a-z0-9_]{3,20}$'`),
    check(
      "blogs_title_check",
      sql`char_length(${t.title}) between 1 and 40 and ${t.title} = btrim(${t.title})`,
    ),
    check("blogs_intro_check", sql`char_length(${t.intro}) <= 160`),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("posts_blog_list_idx").on(t.blogId, t.createdAt.desc(), t.id.desc()),
    index("posts_category_idx").on(t.categoryId),
    index("posts_subcategory_idx").on(t.subcategoryId),
    check("posts_title_check", sql`char_length(${t.title}) between 1 and 100`),
    check("posts_content_html_check", sql`char_length(${t.contentHtml}) <= 200000`),
    check("posts_content_text_check", sql`char_length(btrim(${t.contentText})) >= 1`),
    check(
      "posts_subcategory_needs_category",
      sql`${t.subcategoryId} is null or ${t.categoryId} is not null`,
    ),
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

export type Blog = typeof blogs.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
