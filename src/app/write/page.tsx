import { PostForm } from "@/components/post/PostForm";
import { getCategoryOptions } from "@/server/category";
import { getMyBlog, requireMember } from "@/server/dal";

export const metadata = { title: "새 글 쓰기 | Blogville" };

export default async function WritePage() {
  const member = await requireMember();
  const blog = await getMyBlog(member.userId);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="sr-only">새 글 쓰기</h1>
      <PostForm categories={await getCategoryOptions(blog.id)} draftOwnerId={member.userId} />
    </div>
  );
}
