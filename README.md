# FYP
This will hold my FYP

30/10/2025
Log 1/1:
15:34: The first thing I will need to do is setup a UI for testing. To begin, I want to have hard coded data which involves clickable categories that, when clicked, display their food_types

I'm looking at https://www.youtube.com/watch?v=sm5Y7Vtuihg&t=476s for initial setup. Using npx create-expo-app@latest, I have a template for an app. I will edit the index.tsx script to display my main page.

Log 2/2
16:24: Initial commit made with hard coded data working. Next, I want to change this to call from an sql database made in postgres. I will add the initial SQL script to the repo. I need to use node.js to accomplish this communication

Log 3/3
18:05: Backend added, including server running on port 3000. There is no polling or sockets yet

Next, I will look to add products under the food_types section

31/10/2025
14:43: Below is the ERD I next wish to implement into the project. Categories, Food-Types, and Products can remain standardised data for now, but once I implement user specific log ins, I want a user to only see their registered products, which will be stored in user products
<img width="884" height="677" alt="image" src="https://github.com/user-attachments/assets/3d7bbfc7-fdd6-4269-8a1f-f29591bed6eb" />

I will first go abobut creating a sign-in page for the user. I'll leave out account creation for now and simply insert some premade accounts to Postgres


29/01/2026
Today I want to add notifications. The first test will be adding

ALTER TABLE user_products
  ALTER COLUMN expiry_period_days DROP DEFAULT;

ALTER TABLE user_products
  ALTER COLUMN expiry_period_days DROP NOT NULL;

ALTER TABLE user_products
  ALTER COLUMN expiry_period_days SET DEFAULT NULL;

Tests:
-Set user preference to expires within 7 days notifications
-add product for expiry today + 5
-Correctly notified

-Set user preference to expires within 3 days notifications
-add product for expiry today + 5
-Correctly not notified
-update user preference to 7 days
-correctly notified

-Set user preference to expires within 3 days notifications
-add product for expiry today + 5
-Correctly not notified
-update user_products set expiry_period_days = 10 where id = 36;
-correctly notified

-Set user preference to expires within 7 days notifications
-add product for expiry today + 2 with expiry period 1
-expiry period correctly overrides and we do not get a notification as item does not expire tomorrow
-Unexpected behavior!: then setting expiry period to 0 notifies us of product expiring in 2 days

Fix:

ALTER TABLE user_products
ALTER COLUMN expiry_period_days DROP DEFAULT;
ALTER TABLE user_products
ALTER COLUMN expiry_period_days SET DEFAULT NULL;
UPDATE user_products
SET expiry_period_days = NULL
WHERE expiry_period_days = 0;

endpoint change to:
SELECT
  up.id AS user_product_id,
  p.name AS product_name,
  (up.expiry_date::date - CURRENT_DATE) AS days_left,
  COALESCE(up.expiry_period_days, u.notification_period_preference, 0) AS effective_period_days
FROM user_products up
JOIN products p ON p.id = up.product_id
JOIN users u ON u.id = up.user_id
WHERE up.user_id = $1
  AND up.notified = false
  AND (up.expiry_date::date - CURRENT_DATE)
      <= COALESCE(up.expiry_period_days, u.notification_period_preference, 0)
ORDER BY up.id ASC
LIMIT 50;


-test now succeeds
-update this items expiry date to today
-correctly notifies

-Set user preference to expires within 7 days notifications
-add product for expiry today + 7
-correctly notified

-add product with expiry date yesterday
-correctly notified but perhaps "-1 days" in notification should be dealt with 
