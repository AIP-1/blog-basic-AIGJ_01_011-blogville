-- 검색 속도 (개선 15): 글 제목·본문, 블로그 이름·닉네임의 "가운데 글자 찾기"(ILIKE '%낱말%')를 pg_trgm GIN 인덱스로 빠르게 한다.
-- 운영 DB는 공용이라 확장(CREATE EXTENSION)을 만들 권한이 없을 수 있다.
-- 확장이 이미 있거나 만들 수 있으면 인덱스를 만들고, 안 되면 아무것도 하지 않고 넘어간다(검색은 지금처럼 동작).
DO $$
DECLARE
  ext_schema text;
BEGIN
  SELECT n.nspname INTO ext_schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF ext_schema IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      SELECT n.nspname INTO ext_schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_trgm 확장을 쓸 수 없어 검색 인덱스를 건너뜀: %', SQLERRM;
      RETURN;
    END;
  END IF;
  EXECUTE format('CREATE INDEX IF NOT EXISTS posts_title_trgm_idx ON posts USING gin (title %I.gin_trgm_ops)', ext_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS posts_content_text_trgm_idx ON posts USING gin (content_text %I.gin_trgm_ops)', ext_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS blogs_title_trgm_idx ON blogs USING gin (title %I.gin_trgm_ops)', ext_schema);
  EXECUTE format('CREATE INDEX IF NOT EXISTS profiles_nickname_trgm_idx ON profiles USING gin (nickname %I.gin_trgm_ops)', ext_schema);
END $$;
