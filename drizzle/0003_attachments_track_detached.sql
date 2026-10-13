-- 첨부가 글에서 떨어진 시각 (POST-07). 글 삭제의 ON DELETE SET NULL도 이 트리거를 지난다.
CREATE FUNCTION attachments_track_detached() RETURNS trigger AS $$
BEGIN
  IF NEW.post_id IS NULL AND OLD.post_id IS NOT NULL THEN
    NEW.detached_at := now();
  ELSIF NEW.post_id IS NOT NULL THEN
    NEW.detached_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER attachments_track_detached
  BEFORE UPDATE OF post_id ON attachments
  FOR EACH ROW EXECUTE FUNCTION attachments_track_detached();
