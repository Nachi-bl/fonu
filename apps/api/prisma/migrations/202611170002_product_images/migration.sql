ALTER TABLE "Product" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD CONSTRAINT "Product_images_max_seven" CHECK (cardinality("imageUrls") <= 7);
UPDATE "Product" SET "imageUrls" = ARRAY['/images/products/' || CASE "sku"
  WHEN 'STK-001' THEN 'headphones.jpg'
  WHEN 'STK-002' THEN 'desk-lamp.jpg'
  WHEN 'STK-003' THEN 'bottle.jpg'
  WHEN 'STK-004' THEN 'notebook.jpg'
  WHEN 'STK-005' THEN 'keyboard.jpg'
  WHEN 'STK-006' THEN 'tote-bag.jpg'
  WHEN 'STK-007' THEN 'speaker.jpg'
  WHEN 'STK-008' THEN 'mouse.jpg'
END] WHERE "sku" IN ('STK-001','STK-002','STK-003','STK-004','STK-005','STK-006','STK-007','STK-008');
