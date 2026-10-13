/**
 * 지우기처럼 되돌릴 수 없는 폼: 확인 창을 폼 액션(클라이언트 함수) 안에서 묻는다.
 * 서버 액션을 `<form action>`에 바로 달고 onSubmit에서 묻으면, 서버가 그린 진짜 POST 폼이라
 * 화면이 준비되기 전의 클릭이나 자바스크립트 없는 제출이 확인 없이 실행된다.
 * 클라이언트 함수면 준비 전 클릭은 기다렸다가 다시 실행되고, 자바스크립트가 없으면 아무것도 보내지 않는다.
 */
export function confirmFirst(message: string, action: (formData: FormData) => Promise<unknown>) {
  return async (formData: FormData) => {
    if (!window.confirm(message)) return;
    await action(formData);
  };
}
