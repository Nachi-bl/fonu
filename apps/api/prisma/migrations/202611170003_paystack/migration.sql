CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PROCESSING', 'PAID');
ALTER TABLE "Order"
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "paymentCheckoutUrl" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Order_paymentReference_key" ON "Order"("paymentReference");
