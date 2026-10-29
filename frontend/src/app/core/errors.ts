import { HttpErrorResponse } from '@angular/common/http';

/** An error whose message is already written for the shop owner (Thai, no jargon). */
export class AppError extends Error {}

/** Turn any error into a short Thai message a non-technical user understands. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
    const serverMessage = typeof error.error?.message === 'string' ? error.error.message : null;
    if (error.status === 400 || error.status === 409 || error.status === 422) {
      return serverMessage ?? 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
    }
    if (error.status === 401 || error.status === 403) return 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง';
    if (error.status === 404) return 'ไม่พบข้อมูลที่ต้องการ';
    return 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง';
  }
  console.error(error);
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}
