Tôi đang muốn khởi tạo một dự án game nội bộ mang tên Lottery, đây là chương trình sổ số vui xuân nội bộ trong công ty chúng tôi.
Dự kiến số lượng người chơi khoảng 100 người, số lượng vé số mỗi người trung bình khoảng 5 vé.

Techstack:
- Fullstack framework: Nextjs (latest)
- Database: PG
- Cache: Redis
- Payment: Chuyển khoản bằng VietQR và SePay

Actor:
- Admin
- Guest

Database tables:
- users: id, name, email, password_digest, phone, status (enum: active, inactive), role (enum: admin, user), created_at, updated_at
- campaigns: id, title, slug, description, start_time, end_time, payment_type (enum: direct, transfer), bank_name_or_code, account_number, account_holder_name, sepay_gateway, status (enum: active, inactive), exclude_winning_numbers (default: `true`), created_at, updated_at
- campaign_prizes: id, campaign_id, title, prizes_count, matching_digits, prize_value, created_at, updated_at
- tickets: id, campaign_id, user_id, ticket_number, created_at, updated_at
- orders: id, campaign_id, user_id, tickets_count, total_amount, payment_reference_id, expires_at, payment_type (enum: direct, transfer), sepay_transaction_id, payment_status (enum: pending, success, failed), error_message, sepay_transaction_id, received_at, created_at, updated_at
- order_tickets: id, order_id, ticket_number, created_at, updated_at
- winning_numbers: id, campaign_prize_id, number, created_at, updated_at

Các use case cho MVP:
- Hệ thống có một số account được import sẵn.
- Admin có thể đăng nhập hệ thống dựa trên các account đã được import ở đường dẫn /admin/login.
- Các trang ở đường dẫn `/admin/*` yêu cầu phải login tài khoản admin mới có thể sử dụng.
- Admin có thể tạo một campaign gồm các thông tin: Campaign title, slug, description (markdown content), số lượng giải sẽ quay, Ngày giờ bắt đầu (date time), ngày giờ kết thúc, hình thức thanh toán (enum: trực tiếp, chuyển khoản), payment account info, thông tin các giải thưởng.
payment account info gồm các thông tin:
  + bank_name_or_code (để hiển thị & tạo QR)
  + account_number (STK)
  + account_holder_name
  + sepay_gateway
thông tin các giải thưởng là thông tin động có thể add thêm vào hoặc xóa đi gồm có:
  + title
  + số lượng giải
  + số chữ số trùng (tính từ trái qua phải, tối đa 6 chữ số)
  + giá trị giải thưởng

- Guest có thể xem campaign tại đường dẫn /campaigns/:slug, có thể nhìn thấy title, description (markdown content), số lượng giải sẽ quay, số lượng vé đã bán, số lượng người tham gia (count dựa trên email distinct).
- Guest có thể mua Tickets, không giới hạn số lượng trong thời gian diễn ra campaign. Cần điền các thông tin sau khi mua ticket: Nickname, email, số điện thoại, và số lượng vé muốn mua (có hiển thị số tiền tương ứng khi chọn số lượng vé)
- Guest có thể thanh toán tickets dựa trên hình thức thanh toán của compaign, nếu là thanh toán trực tiếp thì bỏ qua bước thanh toán, nếu là chuyển khoản thì hiển thị QR payment để tiến hành flow thanh toán.
- Ticket sẽ được generate số tự động. Mỗi ticket có 6 chữ số, số của mỗi ticket sẽ không được trùng với các số đã có trong DB.
- Sau khi mua ticket thành công người dùng sẽ nhận được email chứa các ticket, mỗi ticket là 1 hình ảnh đính kèm, mua bao nhiêu ticket thì sẽ có bấy nhiêu hình ảnh.
- Admin có thể tiến hành quay số tại đường dẫn `/admin/campaigns/:id/draw`
- Trang quay số có một switch button "Quay thử", cho phép quay nháp, chỉ khi nào tắt switch button này đi thì mới quay thực sự các giải.
- Trang quay số sẽ hiển thị dạng grid 2 columns: bên trái là component 6 digit number scrolling, bên phải là table results sẽ list danh sách các giải cùng các số kết quả.
  - 6 digit number scrolling component gồm các thành phần:
    - Thành phần: Button Start/Stop toggle, digits meter.
    - Cần trigger quay số bằng button Start manually trong mọi trường hợp, không tự động quay số.
    - Mặc định ban đầu sẽ là 000000. Khi bấm bắt đầu thì cả 6 chữ số sẽ scroll, mỗi số sẽ scroll từ 0-9 theo hướng từ trên xuống dưới dạng meter, tham khảo scrolling_meter.png.
    - Khi bấm nút dừng sẽ dừng theo thứ tự từ phải sang trái, số bên phải dừng trước. Số dừng animate có gia tốc giảm dần, thời gian dừng khoảng 5s.
    - Nếu giải có matching_digits nhỏ hơn 6 thì các số padding bên trái không cần quay, giữ nguyên số 0.
    - Khi tất cả các số đã dừng, hiển thị một popup thông báo số trúng giải chính thức và chúc mừng các nickname đã trúng giải tương ứng. Có 2 button: "Đóng" và "Quay giải tiếp". Khi bấm "Quay giải tiếp" sẽ chuyển qua giải tiếp theo nhưng chưa tự động quay.
  - Table results component gồm các cột:
    - Cột 1: Tên giải thưởng. Bên phải là button "Quay giải" (lưu ý chỉ hiển thị icon không hiển thị text "Quay giải")
    - Cột 2: Các số trúng giải.
      - Nếu đã quay số thì hiển thị số trúng giải. Bên phải có một icon button "Quay lại", bấm vào đó sẽ hiển thị popup confirm để xác nhận quay lại.
      - Nếu chưa quay số thì hiển thị placeholder, số lượng giải bao nhiêu thì có bấy nhiêu placeholder, mỗi placeholder có nhiều underscore (giải có matching_digits bao nhiêu thì show bấy nhiêu underscore).
      - Nếu giải đang quay thì chuyển từ underscores thành loading indicator. Lưu ý width của placeholder và loading indicator phải bằng nhau để tránh hiện tượng blink.

Nhiệm vụ của bạn:
- Dựa trên các yêu cầu được cung cấp, bạn có thể đặt các câu hỏi để làm giàu requirements (lưu ý bám sát ý tưởng ban đầu), để lấy thông tin cho việc thực hiện các tài liệu sau:
  - tài liệu: Business overview
  - tài liệu: Use cases
  - tài liệu: Database tables
  - tài liệu: Techstack
  - tài liệu: Architecture
  - tài liệu: API endpoints
  - tài liệu: Site map
  - tài liệu: Implementation & testing plan
Khi đã có đầy đủ thông tin hãy tiến hành tạo tài liệu tương ứng.

---
1. Dùng JWT-based, có Remember me.
2. Password management tạm thời chưa cần reset password.
3. Guest tracking dựa vào email. Khi mua vé hãy kiểm tra email xem user đã tồn tại hay chưa? nếu chưa tồn tại thì hãy tạo user mới, nếu đã tạo thì sử dụng user đó.
4. Ticket pricing sẽ thay đổi theo campaign, do đó hãy thêm một field `ticket_price` vào table `campaigns` để lưu giá vé cho từng campaign. Đơn vị của giá vé là VND.
5. Payment timeout là 10 phút. Nếu khách hàng thanh toán quá thời gian timeout thì hãy xử lý lỗi và hiển thị thông báo cho khách hàng.
6. SePay webhook: Có sử dụng webhook để nhận thông báo thanh toán tự động từ SePay. Sử dụng `payment_reference_id` để so khớp thông tin ở webhook và order, khi nhận được thông báo thanh toán thành công thì hãy cập nhật trạng thái thanh toán của order là `success`. Nếu có lỗi thì hãy cập nhật trạng thái thanh toán của order là `failed` và lưu lỗi vào field `error_message`. Các thông tin còn lại cũng được lưu lại ở các field tương ứng.
7. Payment flow: Khi khách đã scan QR và chuyển khoản thành công, admin không cần confirm, hệ thống sẽ xử lý thông qua webhook.
8. Ticket numbering: khi quay mỗi chữ số tiếp theo sẽ được phán định dựa trên dữ liệu đang có trong DB, đảm bảo số quay được là số trúng nằm trong danh sách các số đã bán, không có trường hợp quay ra số chưa bán.
9. Matching logic: Matching từ bên phải.
Ví dụ:
- Matching digits: 3, số quay giải là `213` nghĩa là các số sau sẽ trúng giải: `***213` (* là số bất kỳ)
- Matching digits: 6, số quay giải là `11220` nghĩa là các số sau sẽ trúng giải: `112200`
10-11. Multiple prizes: Một ticket chỉ có thể trúng 1 giải, trừ khi campaign có config `exclude_winning_numbers` là `false` lúc này mới có thể trúng nhiều giải.
12. Draw order: Quay giải nhỏ trước, lớn sau, order theo matching_digits.
13. Email service dự định dùng sendgrid.
14. Ticket image dự định sẽ dùng canvas, ý tưởng là có 1 image làm template, các số và chữ được render ra trên canvas.
15. Email timing khi mua vé sẽ gửi mail sau khi payment thành công.
16. Có, admin có thể quản lý CRUD campaign.
17. Admin có cần xem danh sách orders, tickets, users: Trước mắt chưa cần.
18. Chưa cần Statistics (revenue, tickets sold, etc.)
19. Có cần export danh sách trúng giải ra Excel/CSV không? Không cần.
20. về ORM dùng Drizzle
21. UI Library: TailwindCSS + shadcn/ui
22. Redis usage chỉ là thông tin thêm, tùy chọn trong quá trình sử dụng, nếu cần cache hoặc nâng cao performance thì sử dụng.
22. Gồm 2 Environments: dev và production.

---
Chức năng đăng nhập:
Tôi muốn thực hiện chức năng đăng nhập như sau:
- Sau khi so khớp login credentials thành công, hệ thống sẽ tạo ra một token base lưu trong redis dưới dạng key-value với key là token base, value là user info (id, role, timestamp, remember_me). Thời gian sống của token base này là 7 ngày nếu có remember me, 2 giờ nếu không có remember me.
- Token base sẽ được sử dụng làm subject trong JWT token.
- Khi verify JWT sẽ giải mã jwt, lấy sub và get user info trong redis dựa trên token base. Nếu không tìm thấy user info trong redis thì sẽ trả về lỗi 401. Nếu tồn tại thì cập nhật EXPIRE time của token base nếu có remember_me, nếu không có remember_me thì cập nhật EXPIRE time của token base là 2 giờ.
- Khi logout, hệ thống sẽ xóa token base trong redis.

Chức năng tạo campaign:
Tôi muốn chia ra làm 3 section:
- Campaign info
- Prizes settings
- Payment settings

Chức năng xóa campaign hãy đổi thành chức năng cancel campaign. Bổ sung thêm trạng thái "canceled" cho campaign và thêm field canceled_at. Campaign canceled thì không thể mua vé được nữa cũng không thể quay số được nữa. Bất kỳ campaign nào nếu chưa quay số thì đều có thể cancel được. Như vậy campaign sẽ có các status sau:
- active: Mặc định sau khi đăng ký campaign.
- drawing: Khi bắt đầu quay số (popup xác nhận confirm bắt đầu quay số)
- completed: Khi chương trình quay số xong (popup xác nhận confirm hoàn tất quay số).
- canceled: Khi admin cancel campaign.

ở UC07, bước "9. System generates unique ticket numbers (6 digits each)" không cần thiết, thay vào đó hãy thực hiện generates unique ticket numbers ở bước 16, ngay trước khi insert tickets vào DB.
Ngoài ra có lẽ cần bổ sung thêm mô tả về cơ chế polling để kiểm tra trạng thái thanh toán của order.

ở UC11, tôi muốn ở bước 5, khi click button thì sẽ tiến hành query DB để tìm số trúng thưởng, khi phán định được số trúng thưởng thì sẽ bắt đầu khiến cho animation scroll đến số trúng đó theo từng chữ số một từ phải qua trái.

UC14 hiện tại chưa cần. Thay vào đó các order hết hạn sẽ được chuyển sang trạng thái fail tại thời điểm bấm nút hoàn thành quay số (lúc này campaign có status là completed).

---

Bảng users (kể cả các bảng khác) thì id và uuid là 2 column khác nhau nhé.
id là tự động tăng, nó sẽ là primary key cho table. reference trên các table khác sẽ dùng id.
uuid là random UUID v4 không phải primary key, trong một số trường hợp nếu cần sử dụng để reference đến một hệ thống bên thứ 3 thì sẽ dùng uuid thay vì id.

Bảng `order_tickets` sẽ lưu `ticket_id` là khóa phụ đến table `tickets` thay vì `ticket_number`.

Bảng `winning_numbers` trường `number` chỉ lưu số trúng thưởng với số lượng ký tự đúng bằng `matching_digits` của giải thưởng, không có số 0 padding bên trái. Ví dụ số quay được là 321 thì sẽ lưu là `321`, không phải `000321`.

Trước mắt chưa cần cơ chế backup nên mục Backup & Recovery hãy bỏ đi.

----

Techstack

Datetime format hãy sử dụng dayjs
Nextjs hãy sử dụng version 16.1.4
Backend tôi muốn dùng Nextjs API Routes, node 24.13.0
Testing tôi muốn apply unit test sử dụng Vitest luôn trong phase này.
Deployment tôi sẽ dùng EC2, đóng gói tất cả bằng docker compose. Nhưng trước mắt chưa cần quan tâm đến vấn đề này. Ở local development sẽ sử dụng trực tiếp node, pg, redis,... không cần docker.
các mục Redis Hosting và Database Hosting hiện tại chưa cần quan tâm, có thể bỏ.
Mục Future Considerations cũng chưa cần đưa vào.

---
06-endpoints.md:

Các API route đều phải đặt ở đường dẫn `api/v1`, Các API dành cho Admin only hãy đặt trong namespace admin: `api/v1/admin`.

2 API sau thực tế chỉ cần dùng 1 vì hiện không có chức năng delete nữa mà chỉ có cancel. Tuy nhiên vì cancel thực chất là Update status thành canceled nên hãy sử dụng lại API PUT để update status thành canceled. 2 API này không cần dùng đến:
- DELETE /api/campaigns/:id
- POST /api/campaigns/:id/cancel

API endpoints của draw tôi muốn thay đổi như sau:

GET /api/campaigns/:campaignId/prizes: Get prizes for a campaign with current draw status.
POST /api/draw/:campaignId/start: Có vẻ không cần thiết.
POST /api/draw/:campaignId/stop: nên đổi thành `POST /api/campaigns/:campaignId/draw`: Stop drawing and get winning number (query-first approach), trong response trả về thêm object `winning_number`.
POST /api/draw/:campaignId/save: Không cần thiết, API này `POST /api/campaigns/:campaignId/draw` sẽ save luôn winning number tại thời điểm đó. Trong trường hợp bấm quay lại thì sẽ gọi API để clear winning number đã save. Do đó hãy tạo thêm API `DELETE /api/winning_numbers/:winning_number_id` để clear winning number đã save.
POST /api/draw/:campaignId/redo: Thừa không cần thiết, bỏ đi.
POST /api/campaigns/:campaignId/prizes: Thừa không cần thiết, hãy tái sử dụng API `PUT /api/campaigns/:campaignId` để update status thành `completed`.
POST /api/draw/:campaignId/next-digit: Thừa, bỏ đi.

Các cron sau không cần thiết, hãy bỏ đi:
GET /api/cron/check-expired-orders

---

Landing Page phase này chưa cần thực hiện, hãy redirect đến `/admin/login`.
Trang `/orders/:referenceId/success` không cần thiết tạo 1 trang, success chỉ là trạng thái thành công của order, do đó hãy hãy control việc show success thông qua react state để render nội dung trên chính trang `/orders/:referenceId/payment`

Route: /admin/campaigns/:id/draw hãy dùng layout full màn hình cho trang này. Mặc dù trang thuộc namespace admin nhưng vẫn dùng layout full màn hình giống như trang landing page để đảm bảo UX tốt nhất chứ đừng sử dụng layout của admin.

Top Bar
Search không cần show.
Notifications không cần show.
