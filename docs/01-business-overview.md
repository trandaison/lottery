# Business Overview

## Project Name
**Lottery** - Chương trình Sổ Số Vui Xuân Nội Bộ

## Purpose
Lottery là một hệ thống quản lý chương trình sổ số vui xuân nội bộ trong công ty, cho phép nhân viên mua vé số và tham gia các chiến dịch quay số trúng thưởng. Hệ thống giúp tự động hóa toàn bộ quy trình từ việc mua vé, thanh toán, đến quay số và thông báo kết quả.

## Business Goals
1. **Tăng cường sự gắn kết nội bộ**: Tạo một hoạt động vui chơi giải trí cho nhân viên trong dịp lễ tết
2. **Tự động hóa quy trình**: Giảm thiểu công việc thủ công trong việc quản lý vé số và quay thưởng
3. **Minh bạch và công bằng**: Đảm bảo quy trình quay số minh bạch, công khai với tất cả người tham gia
4. **Dễ dàng tham gia**: Người dùng có thể mua vé và thanh toán trực tuyến một cách thuận tiện

## Target Users

### Admin (Quản trị viên)
- **Vai trò**: Nhân sự phụ trách tổ chức sự kiện
- **Số lượng**: 1-2 người
- **Nhu cầu**:
  - Tạo và quản lý các chiến dịch sổ số
  - Cấu hình thông tin thanh toán và giải thưởng
  - Tiến hành quay số trực tiếp
  - Quản lý toàn bộ hệ thống

### Guest (Người tham gia)
- **Vai trò**: Nhân viên công ty muốn tham gia chương trình
- **Số lượng dự kiến**: ~100 người
- **Nhu cầu**:
  - Xem thông tin chiến dịch
  - Mua vé số trực tuyến
  - Thanh toán qua chuyển khoản ngân hàng
  - Nhận vé qua email
  - Xem kết quả quay số

## Business Model

### Revenue Model
- Không hướng tới lợi nhuận (nội bộ công ty)
- Mục tiêu: Thu đủ chi phí giải thưởng và vận hành

### Pricing Strategy
- Giá vé linh hoạt theo từng chiến dịch
- Admin tự định giá dựa trên tổng giá trị giải thưởng và số lượng vé dự kiến bán
- Đơn vị: VND

## Key Features

### For Admin
1. **Campaign Management**: Tạo, sửa, cancel các chiến dịch sổ số
2. **Prize Configuration**: Cấu hình đa dạng các giải thưởng với số chữ số trùng khớp khác nhau
3. **Live Drawing**: Quay số trực tiếp với hiệu ứng hấp dẫn
4. **Draft Mode**: Chế độ quay thử để test trước khi quay chính thức

### For Guest
1. **Campaign Discovery**: Xem thông tin chiến dịch chi tiết
2. **Ticket Purchase**: Mua vé không giới hạn số lượng
3. **Online Payment**: Thanh toán qua VietQR/SePay
4. **Email Notification**: Nhận vé qua email với hình ảnh chi tiết
5. **Real-time Stats**: Xem số lượng vé đã bán và người tham gia

## Scale & Performance

### Expected Load
- Số người tham gia: ~100 users
- Số vé trung bình/người: 5 vé
- Tổng số vé dự kiến: ~500 vé/chiến dịch
- Concurrent users: 20-30 users (peak time khi mở bán)

### Performance Requirements
- Response time: < 2s cho mọi thao tác (trường hợp lý tưởng, không bắt buộc)
- Payment processing: < 1 phút từ lúc chuyển khoản đến lúc nhận vé (trường hợp lý tưởng, không bắt buộc)
- Email delivery: < 3 phút sau khi thanh toán thành công (trường hợp lý tưởng, không bắt buộc)
- Drawing animation: Smooth 60fps

## Business Rules

### Ticket Rules
1. Mỗi vé có 6 chữ số duy nhất.
2. Số của vé sẽ được random tại thời điểm đăng ký vé. Số vé không được trùng lặp trong cùng một chiến dịch
3. Vé chỉ có thể mua trong thời gian chiến dịch (từ start_time đến end_time)
4. Không giới hạn số lượng vé một người có thể mua

### Payment Rules
1. Hỗ trợ 2 hình thức: Thanh toán trực tiếp và chuyển khoản. Thanh toán trực tiếp sẽ diễn ra ngoài hệ thống, không cần xử lý trong hệ thống, order sẽ được tạo và cập nhật trạng thái thanh toán thành công. Chuyển khoản sẽ diễn ra trong hệ thống, order sẽ được tạo và cập nhật trạng thái thanh toán thành công sau khi thanh toán thành công.
Một số thông tin cần lưu ý với hình thức thanh toán chuyển khoản:
  - Timeout thanh toán: 10 phút, sau khi hết timeout, order sẽ bị hủy.
  - Chỉ phát hành vé sau khi thanh toán thành công

### Drawing Rules
1. Chỉ quay số sau khi chiến dịch kết thúc
2. Quay từ giải nhỏ đến giải lớn (matching_digits thấp đến cao, nếu trùng matching_digits thì order theo created_at tăng dần)
3. Số quay được phải là số có người mua
4. Một vé chỉ trúng một giải (trừ khi `exclude_winning_numbers = false`)
5. Admin có thể quay lại nếu có sai sót

## Success Metrics
1. **Participation Count**: Số lượng người mua vé
2. **Ticket Sales**: Số lượng vé bán được

## Risk & Mitigation

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Payment webhook failure | High | manual verification |
| Duplicate ticket numbers | High | Use database unique constraint và transaction |
| Email delivery failure | Medium | Queue-based system với retry logic |
| High concurrent purchase | Medium | Implement rate limiting và caching |

### Business Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Low participation | Low | Có thể cancel campaign |
| Payment disputes | Medium | Clear terms và support channel |
| Drawing transparency concerns | High | Public live drawing với witnesses |

## Timeline & Phases

### Phase 1: MVP (Current Scope)
- Core features: Campaign management, ticket purchase, payment, drawing
- Support 100 users, 500 tickets
- Basic email notification
- Manual admin operations

### Phase 2: Enhancement (Future)
- Admin dashboard với statistics
- Export winning list
- Mobile responsive optimization
- Performance optimization với Redis caching

## Compliance & Security
- **Data Privacy**: Chỉ thu thập thông tin cần thiết (name, email, phone)
- **Payment Security**: Sử dụng gateway bên thứ 3 (SePay), không lưu thông tin thẻ/bank
- **Authentication**: JWT-based authentication cho admin
- **Data Retention**: Lưu trữ dữ liệu chiến dịch vô thời hạn cho mục đích lịch sử
