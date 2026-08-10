export { ordersRouter } from "./routes/orders.routes.js";
export { adminOrdersRouter } from "./routes/admin.routes.js";
export {
  getOrder,
  listOrders,
  placeOrder,
} from "./service/orders.service.js";
export {
  getAdminOrder,
  listAdminOrders,
  updateOrderStatus,
} from "./service/admin.service.js";
