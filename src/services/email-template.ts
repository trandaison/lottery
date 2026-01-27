/**
 * Email Template Generator
 *
 * Generates HTML email templates for ticket purchase confirmations.
 * Uses inline CSS for email client compatibility.
 *
 * Architecture Principles:
 * - Single responsibility: Only handles template generation
 * - Clean code: Simple, focused function
 * - Responsive design: Works on mobile and desktop
 */
export interface EmailTemplateData {
  userName: string;
  campaignTitle: string;
  orderReference: string;
  ticketsCount: number;
  totalAmount: number;
  ticketNumbers: string[];
}

/**
 * Generate HTML email template for ticket purchase confirmation
 *
 * @param data - Email template data
 * @returns HTML string
 */
export function generateEmailTemplate(data: EmailTemplateData): string {
  const { userName, campaignTitle, orderReference, ticketsCount, totalAmount, ticketNumbers } = data;

  // Format amount as VND
  const formattedAmount = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(totalAmount);

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận mua vé</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0; text-align: center; background-color: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333333; margin: 0; font-size: 24px;">Xác nhận mua vé thành công</h1>
          </div>

          <!-- Content -->
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e0e0e0;">
            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Xin chào <strong>${escapeHtml(userName)}</strong>,
            </p>

            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Cảm ơn bạn đã tham gia chương trình <strong>${escapeHtml(campaignTitle)}</strong>.
            </p>

            <!-- Order Details -->
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h2 style="color: #333333; font-size: 18px; margin: 0 0 15px 0;">Thông tin đơn hàng</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">Mã đơn hàng:</td>
                  <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold; text-align: right;">${escapeHtml(orderReference)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">Số lượng vé:</td>
                  <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold; text-align: right;">${ticketsCount} vé</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-size: 14px;">Tổng tiền:</td>
                  <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: bold; text-align: right;">${formattedAmount}</td>
                </tr>
              </table>
            </div>

            <!-- Ticket Numbers -->
            <div style="margin: 20px 0;">
              <h2 style="color: #333333; font-size: 18px; margin: 0 0 15px 0;">Số vé của bạn</h2>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px;">
                <p style="color: #333333; font-size: 14px; margin: 0 0 10px 0;">
                  ${ticketNumbers.map((num) => `<span style="display: inline-block; background-color: #ffffff; padding: 8px 12px; margin: 4px; border-radius: 4px; border: 1px solid #e0e0e0; font-weight: bold; font-size: 16px;">${escapeHtml(num)}</span>`).join('')}
                </p>
              </div>
            </div>

            <!-- Attachments Note -->
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="color: #1976d2; font-size: 14px; margin: 0; line-height: 1.6;">
                <strong>📎 Đính kèm:</strong> Email này có đính kèm hình ảnh của từng vé. Vui lòng kiểm tra phần đính kèm để xem hình ảnh vé của bạn.
              </p>
            </div>

            <!-- Instructions -->
            <div style="margin: 20px 0;">
              <h2 style="color: #333333; font-size: 18px; margin: 0 0 15px 0;">Hướng dẫn</h2>
              <ul style="color: #333333; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Vui lòng lưu giữ email này và hình ảnh vé đính kèm để tham gia quay số.</li>
                <li>Số vé của bạn sẽ được sử dụng trong quá trình quay số.</li>
                <li>Kết quả quay số sẽ được thông báo sau khi quá trình quay số hoàn tất.</li>
                <li>Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ với ban tổ chức.</li>
              </ul>
            </div>

            <!-- Footer -->
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
                Email này được gửi tự động từ hệ thống Lottery. Vui lòng không trả lời email này.
              </p>
            </div>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
