"use client";

import { useActionState, useState } from "react";
import {
  addCategory,
  deleteCategory,
  moveCategory,
  renameCategory,
  type CategoryState,
} from "@/app/settings/blog/actions";
import type { CategoryTree } from "@/server/category";

/** count: 이 카테고리의 글 수 (비공개 포함, 대분류는 소분류 글도) */
type Row = { kind: "category" | "sub"; id: number; name: string; count: number; parentName?: string; first: boolean; last: boolean };

export function CategoryManager({ tree }: { tree: CategoryTree }) {
  const [addState, addAction, adding] = useActionState<CategoryState, FormData>(addCategory, null);
  const [openSub, setOpenSub] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {tree.length === 0 && <p className="text-ink-soft">아직 카테고리가 없어요.</p>}
      <ul className="space-y-1">
        {tree.map((c, i) => (
          <li key={c.id} className="rounded-lg border border-line">
            <CategoryRow row={{ kind: "category", id: c.id, name: c.name, count: c.postCount, first: i === 0, last: i === tree.length - 1 }} onAddSub={() => setOpenSub(c.id)} />
            <ul className="pl-6">
              {c.subs.map((s, j) => (
                <li key={s.id} className="border-t border-line">
                  <CategoryRow row={{ kind: "sub", id: s.id, name: s.name, count: s.postCount, parentName: c.name, first: j === 0, last: j === c.subs.length - 1 }} />
                </li>
              ))}
            </ul>
            {openSub === c.id && <AddForm parentId={c.id} onDone={() => setOpenSub(null)} />}
          </li>
        ))}
      </ul>

      <form action={addAction} className="space-y-1 pt-2" key={JSON.stringify(addState)}>
        <div className="flex gap-2">
          <input name="name" aria-label="새 카테고리 이름" placeholder="새 카테고리 이름" className="field" maxLength={20} defaultValue={addState?.error ? addState.values?.name : ""} />
          <button type="submit" className="btn btn-primary" disabled={adding}>
            추가
          </button>
        </div>
        {addState?.error && (
          <p role="alert" className="form-error">
            {addState.error}
          </p>
        )}
      </form>
    </div>
  );
}

function AddForm({ parentId, onDone }: { parentId: number; onDone: () => void }) {
  const [state, action, pending] = useActionState<CategoryState, FormData>(async (prev, formData) => {
    const next = await addCategory(prev, formData);
    if (!next?.error) onDone();
    return next;
  }, null);
  return (
    <form action={action} className="space-y-1 border-t border-line p-2 pl-6" key={JSON.stringify(state)}>
      <input type="hidden" name="categoryId" value={parentId} />
      <div className="flex gap-2">
        <input name="name" aria-label="소분류 이름" placeholder="소분류 이름" className="field" maxLength={20} autoFocus defaultValue={state?.values?.name} />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          추가
        </button>
        <button type="button" className="btn" onClick={onDone}>
          취소
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
    </form>
  );
}

function CategoryRow({ row, onAddSub }: { row: Row; onAddSub?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<CategoryState, FormData>(async (prev, formData) => {
    const next = await renameCategory(prev, formData);
    if (!next?.error) setEditing(false);
    return next;
  }, null);

  const confirmText =
    row.kind === "category"
      ? `'${row.name}' 카테고리를 지울까요? 글은 남고 '카테고리 없음'이 돼요.`
      : `'${row.name}' 소분류를 지울까요? 글은 '${row.parentName}'에 남아요.`;

  if (editing)
    return (
      <form action={action} className="space-y-1 p-2" key={JSON.stringify(state)}>
        <input type="hidden" name="kind" value={row.kind} />
        <input type="hidden" name="id" value={row.id} />
        <div className="flex gap-2">
          <input name="name" aria-label={`${row.name} 새 이름`} className="field" maxLength={20} autoFocus defaultValue={state?.values?.name ?? row.name} />
          <button type="submit" className="btn btn-primary" disabled={pending}>
            저장
          </button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>
            취소
          </button>
        </div>
        {state?.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
      </form>
    );

  const hidden = (
    <>
      <input type="hidden" name="kind" value={row.kind} />
      <input type="hidden" name="id" value={row.id} />
    </>
  );
  return (
    <div className="flex flex-wrap items-center gap-1 p-1">
      <span className="flex-1 px-2">
        <span className={row.kind === "category" ? "font-semibold" : ""}>{row.name}</span>{" "}
        <span className="text-sm text-ink-soft" data-post-count>
          ({row.count})
        </span>
      </span>
      <form action={moveCategory}>
        {hidden}
        <input type="hidden" name="direction" value="-1" />
        <button type="submit" className="btn btn-ghost px-2" disabled={row.first} aria-label={`${row.name} 위로`}>
          ▲
        </button>
      </form>
      <form action={moveCategory}>
        {hidden}
        <input type="hidden" name="direction" value="1" />
        <button type="submit" className="btn btn-ghost px-2" disabled={row.last} aria-label={`${row.name} 아래로`}>
          ▼
        </button>
      </form>
      {onAddSub && (
        <button type="button" className="btn btn-ghost px-2 text-sm" onClick={onAddSub}>
          소분류 추가
        </button>
      )}
      <button type="button" className="btn btn-ghost px-2 text-sm" onClick={() => setEditing(true)}>
        이름 바꾸기
      </button>
      <form action={deleteCategory} onSubmit={(e) => !confirm(confirmText) && e.preventDefault()}>
        {hidden}
        <button type="submit" className="btn btn-danger btn-ghost px-2 text-sm">
          삭제
        </button>
      </form>
    </div>
  );
}
