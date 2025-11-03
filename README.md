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




