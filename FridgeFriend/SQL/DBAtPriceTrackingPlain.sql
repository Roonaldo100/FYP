--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

-- Started on 2026-02-24 19:49:35

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 16471)
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(20)
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 16470)
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- TOC entry 4975 (class 0 OID 0)
-- Dependencies: 217
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- TOC entry 220 (class 1259 OID 16480)
-- Name: food_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.food_types (
    id integer NOT NULL,
    category integer,
    name character varying(20)
);


ALTER TABLE public.food_types OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16479)
-- Name: food_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.food_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.food_types_id_seq OWNER TO postgres;

--
-- TOC entry 4976 (class 0 OID 0)
-- Dependencies: 219
-- Name: food_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.food_types_id_seq OWNED BY public.food_types.id;


--
-- TOC entry 227 (class 1259 OID 16519)
-- Name: product_store; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_store (
    product_id integer NOT NULL,
    store_id integer NOT NULL,
    price numeric(10,2)
);


ALTER TABLE public.product_store OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16492)
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    food_type integer,
    name character varying(30),
    barcode character varying(50)
);


ALTER TABLE public.products OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16491)
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- TOC entry 4977 (class 0 OID 0)
-- Dependencies: 221
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- TOC entry 233 (class 1259 OID 16573)
-- Name: recipe_ingredients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipe_ingredients (
    id integer NOT NULL,
    recipe_id integer NOT NULL,
    product_id integer,
    name text NOT NULL,
    amount numeric,
    unit text,
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.recipe_ingredients OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 16572)
-- Name: recipe_ingredients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recipe_ingredients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recipe_ingredients_id_seq OWNER TO postgres;

--
-- TOC entry 4978 (class 0 OID 0)
-- Dependencies: 232
-- Name: recipe_ingredients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recipe_ingredients_id_seq OWNED BY public.recipe_ingredients.id;


--
-- TOC entry 231 (class 1259 OID 16555)
-- Name: recipes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipes (
    id integer NOT NULL,
    title text NOT NULL,
    source text DEFAULT 'custom'::text NOT NULL,
    external_id text,
    source_url text,
    created_by_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    nutrition_json jsonb,
    servings integer,
    nutrition_updated_at timestamp without time zone
);


ALTER TABLE public.recipes OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 16554)
-- Name: recipes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recipes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recipes_id_seq OWNER TO postgres;

--
-- TOC entry 4979 (class 0 OID 0)
-- Dependencies: 230
-- Name: recipes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recipes_id_seq OWNED BY public.recipes.id;


--
-- TOC entry 224 (class 1259 OID 16504)
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stores (
    id integer NOT NULL,
    name character varying(30)
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16503)
-- Name: stores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stores_id_seq OWNER TO postgres;

--
-- TOC entry 4980 (class 0 OID 0)
-- Dependencies: 223
-- Name: stores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stores_id_seq OWNED BY public.stores.id;


--
-- TOC entry 229 (class 1259 OID 16535)
-- Name: user_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_products (
    id integer NOT NULL,
    user_id integer,
    product_id integer NOT NULL,
    store_id integer,
    expiry_date date,
    expiry_period_days integer,
    notified boolean DEFAULT false
);


ALTER TABLE public.user_products OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16534)
-- Name: user_product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_product_id_seq OWNER TO postgres;

--
-- TOC entry 4981 (class 0 OID 0)
-- Dependencies: 228
-- Name: user_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_product_id_seq OWNED BY public.user_products.id;


--
-- TOC entry 236 (class 1259 OID 16625)
-- Name: user_product_prices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_product_prices (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    store_id integer,
    last_price numeric(10,2),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_product_prices OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 16624)
-- Name: user_product_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_product_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_product_prices_id_seq OWNER TO postgres;

--
-- TOC entry 4982 (class 0 OID 0)
-- Dependencies: 235
-- Name: user_product_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_product_prices_id_seq OWNED BY public.user_product_prices.id;


--
-- TOC entry 234 (class 1259 OID 16593)
-- Name: user_saved_recipes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_saved_recipes (
    user_id integer NOT NULL,
    recipe_id integer NOT NULL,
    saved_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_saved_recipes OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16511)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(30),
    password character varying(30),
    notification_period_preference integer DEFAULT 0
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16510)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 4983 (class 0 OID 0)
-- Dependencies: 225
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4743 (class 2604 OID 16474)
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- TOC entry 4744 (class 2604 OID 16483)
-- Name: food_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_types ALTER COLUMN id SET DEFAULT nextval('public.food_types_id_seq'::regclass);


--
-- TOC entry 4745 (class 2604 OID 16495)
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- TOC entry 4754 (class 2604 OID 16576)
-- Name: recipe_ingredients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_ingredients ALTER COLUMN id SET DEFAULT nextval('public.recipe_ingredients_id_seq'::regclass);


--
-- TOC entry 4751 (class 2604 OID 16558)
-- Name: recipes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes ALTER COLUMN id SET DEFAULT nextval('public.recipes_id_seq'::regclass);


--
-- TOC entry 4746 (class 2604 OID 16507)
-- Name: stores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores ALTER COLUMN id SET DEFAULT nextval('public.stores_id_seq'::regclass);


--
-- TOC entry 4757 (class 2604 OID 16628)
-- Name: user_product_prices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_product_prices ALTER COLUMN id SET DEFAULT nextval('public.user_product_prices_id_seq'::regclass);


--
-- TOC entry 4749 (class 2604 OID 16538)
-- Name: user_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_products ALTER COLUMN id SET DEFAULT nextval('public.user_product_id_seq'::regclass);


--
-- TOC entry 4747 (class 2604 OID 16514)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4951 (class 0 OID 16471)
-- Dependencies: 218
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name) FROM stdin;
1	Fruit
2	Vegetables
3	Meat
4	Other
\.


--
-- TOC entry 4953 (class 0 OID 16480)
-- Dependencies: 220
-- Data for Name: food_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.food_types (id, category, name) FROM stdin;
1	1	Apples
2	1	Bananas
3	1	Strawberries
4	2	Carrots
5	3	Steak
\.


--
-- TOC entry 4960 (class 0 OID 16519)
-- Dependencies: 227
-- Data for Name: product_store; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_store (product_id, store_id, price) FROM stdin;
1	1	2.00
1	2	2.30
2	1	2.00
3	1	4.00
11	1	0.00
12	1	0.00
13	1	0.00
14	1	0.00
15	1	0.00
16	1	0.00
17	1	0.00
22	1	0.00
16	2	0.00
16	3	0.00
26	2	0.00
27	1	0.00
28	1	0.00
29	3	0.00
30	3	0.00
31	1	0.00
32	4	0.00
33	3	0.00
\.


--
-- TOC entry 4955 (class 0 OID 16492)
-- Dependencies: 222
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, food_type, name, barcode) FROM stdin;
1	3	Maisy Strawberrys	\N
2	2	Maisy Bananas	\N
3	4	McDonald Carrots	\N
10	1	Heroes	7622202274725
11	1	Cookie crisp	8445291254107
12	1	Wholegrain Premium Bread	5011059000076
13	1	30% Reduced Fat Houmous	5019624002791
14	1	Grissini Breadsticks	4335619101067
15	2	Crunchy Peanut Butter	5051898719357
16	4	Blackcurrant Squash	5054267003378
17	5	My authentic greek yoghurt 10%	5202234620329
22	4	Tesco Vegetable Soup	5000436960171
26	5	Steakyay	1
27	1	Lemon	\N
28	5	Pb	\N
29	4	Milk	\N
30	4	Pricetest	\N
31	4	Pricetest2	\N
32	4	Pricetwst3	\N
33	4	Pricetest5	\N
\.


--
-- TOC entry 4966 (class 0 OID 16573)
-- Dependencies: 233
-- Data for Name: recipe_ingredients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipe_ingredients (id, recipe_id, product_id, name, amount, unit, "position") FROM stdin;
1	1	\N	baking powder	\N	\N	1
2	1	\N	cinnamon	\N	\N	2
3	1	\N	flour	\N	\N	3
4	1	\N	granny smith apples	\N	\N	4
5	1	\N	margarine	\N	\N	5
6	1	\N	powdered sugar	\N	\N	6
7	1	\N	salt	\N	\N	7
8	1	\N	sugar	\N	\N	8
9	1	\N	sachets vanilla sugar	\N	\N	9
10	1	\N	yogurt	\N	\N	10
11	2	\N	Egg	\N	\N	1
12	2	\N	Milk	\N	\N	2
13	2	\N	Flour	\N	\N	3
14	3	\N	Milk	\N	\N	1
15	3	\N	Tomato	\N	\N	2
16	4	\N	butter	\N	\N	1
17	4	\N	sugar	\N	\N	2
18	4	\N	vanilla extract	\N	\N	3
19	4	\N	eggs	\N	\N	4
20	4	\N	lemons	\N	\N	5
21	4	\N	flour	\N	\N	6
22	4	\N	baking powder	\N	\N	7
23	4	\N	icing sugar	\N	\N	8
24	4	\N	sprinkles	\N	\N	9
25	5	\N	Pb	\N	\N	1
26	5	\N	Bread	\N	\N	2
27	6	\N	A	\N	\N	1
33	10	\N	apricot jam	\N	\N	1
34	10	\N	cornstarch	\N	\N	2
35	10	\N	egg yolk	\N	\N	3
36	10	\N	flour	\N	\N	4
37	10	\N	granny smith apples	\N	\N	5
38	10	\N	ground cinnamon	\N	\N	6
39	10	\N	pch ground nutmeg	\N	\N	7
40	10	\N	lemon juice	\N	\N	8
41	10	\N	lemon peel	\N	\N	9
42	10	\N	mint	\N	\N	10
43	10	\N	pn salt	\N	\N	11
44	10	\N	sugar	\N	\N	12
45	10	\N	butter	\N	\N	13
46	10	\N	water	\N	\N	14
47	10	\N	whipped cream	\N	\N	15
51	12	\N	basil	\N	\N	1
52	12	\N	mozzarella cheese	\N	\N	2
53	12	\N	garlic clove	\N	\N	3
54	12	\N	grape tomatoes	\N	\N	4
55	12	\N	kosher salt	\N	\N	5
56	12	\N	olive oil	\N	\N	6
57	12	\N	linguine pasta	\N	\N	7
\.


--
-- TOC entry 4964 (class 0 OID 16555)
-- Dependencies: 231
-- Data for Name: recipes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipes (id, title, source, external_id, source_url, created_by_user_id, created_at, nutrition_json, servings, nutrition_updated_at) FROM stdin;
2	Pancakes	custom	\N	\N	1	2026-02-17 16:41:36.865275+00	\N	\N	\N
3	Soup	custom	\N	\N	1	2026-02-17 17:21:53.129541+00	\N	\N	\N
5	Pb sandwich	custom	\N	\N	1	2026-02-17 17:23:27.655936+00	\N	\N	\N
6	Test	custom	\N	\N	1	2026-02-17 18:59:30.365958+00	\N	\N	\N
10	Glazed Apple Tart	spoonacular	644730	https://www.foodista.com/recipe/N7B8XYG6/glazed-apple-tart	\N	2026-02-18 17:56:46.050731+00	{"nutrients": [{"name": "Calories", "unit": "kcal", "amount": 248.52, "percentOfDailyNeeds": 12.43}, {"name": "Fat", "unit": "g", "amount": 8.27, "percentOfDailyNeeds": 12.73}, {"name": "Saturated Fat", "unit": "g", "amount": 4.88, "percentOfDailyNeeds": 30.5}, {"name": "Carbohydrates", "unit": "g", "amount": 42.55, "percentOfDailyNeeds": 14.18}, {"name": "Net Carbohydrates", "unit": "g", "amount": 39.58, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 20.19, "percentOfDailyNeeds": 22.43}, {"name": "Cholesterol", "unit": "mg", "amount": 44.11, "percentOfDailyNeeds": 14.7}, {"name": "Sodium", "unit": "mg", "amount": 202.76, "percentOfDailyNeeds": 8.82}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Alcohol %", "unit": "%", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Protein", "unit": "g", "amount": 3.14, "percentOfDailyNeeds": 6.28}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.19, "percentOfDailyNeeds": 12.57}, {"name": "Selenium", "unit": "µg", "amount": 8.77, "percentOfDailyNeeds": 12.53}, {"name": "Fiber", "unit": "g", "amount": 2.97, "percentOfDailyNeeds": 11.87}, {"name": "Folate", "unit": "µg", "amount": 45.98, "percentOfDailyNeeds": 11.5}, {"name": "Manganese", "unit": "mg", "amount": 0.2, "percentOfDailyNeeds": 10.16}, {"name": "Vitamin C", "unit": "mg", "amount": 7.28, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.15, "percentOfDailyNeeds": 8.82}, {"name": "Iron", "unit": "mg", "amount": 1.24, "percentOfDailyNeeds": 6.88}, {"name": "Vitamin B3", "unit": "mg", "amount": 1.34, "percentOfDailyNeeds": 6.69}, {"name": "Vitamin A", "unit": "IU", "amount": 331.91, "percentOfDailyNeeds": 6.64}, {"name": "Phosphorus", "unit": "mg", "amount": 50.24, "percentOfDailyNeeds": 5.02}, {"name": "Potassium", "unit": "mg", "amount": 149.45, "percentOfDailyNeeds": 4.27}, {"name": "Copper", "unit": "mg", "amount": 0.08, "percentOfDailyNeeds": 3.89}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 3.15}, {"name": "Vitamin E", "unit": "mg", "amount": 0.46, "percentOfDailyNeeds": 3.07}, {"name": "Magnesium", "unit": "mg", "amount": 11.88, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 2.7, "percentOfDailyNeeds": 2.57}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.25, "percentOfDailyNeeds": 2.49}, {"name": "Calcium", "unit": "mg", "amount": 24.22, "percentOfDailyNeeds": 2.42}, {"name": "Zinc", "unit": "mg", "amount": 0.29, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0.25, "percentOfDailyNeeds": 1.68}, {"name": "Vitamin B12", "unit": "µg", "amount": 0.07, "percentOfDailyNeeds": 1.22}], "flavonoids": [{"name": "Cyanidin", "unit": "mg", "amount": 1.43}, {"name": "Petunidin", "unit": "mg", "amount": 0}, {"name": "Delphinidin", "unit": "mg", "amount": 0}, {"name": "Malvidin", "unit": "mg", "amount": 0}, {"name": "Pelargonidin", "unit": "mg", "amount": 0}, {"name": "Peonidin", "unit": "mg", "amount": 0.02}, {"name": "Catechin", "unit": "mg", "amount": 1.22}, {"name": "Epigallocatechin", "unit": "mg", "amount": 0.24}, {"name": "Epicatechin", "unit": "mg", "amount": 6.89}, {"name": "Epicatechin 3-gallate", "unit": "mg", "amount": 0.01}, {"name": "Epigallocatechin 3-gallate", "unit": "mg", "amount": 0.17}, {"name": "Theaflavin", "unit": "", "amount": 0}, {"name": "Thearubigins", "unit": "", "amount": 0}, {"name": "Eriodictyol", "unit": "mg", "amount": 0.22}, {"name": "Hesperetin", "unit": "mg", "amount": 0.56}, {"name": "Naringenin", "unit": "mg", "amount": 0.05}, {"name": "Apigenin", "unit": "mg", "amount": 0.01}, {"name": "Luteolin", "unit": "mg", "amount": 0.13}, {"name": "Isorhamnetin", "unit": "mg", "amount": 0}, {"name": "Kaempferol", "unit": "mg", "amount": 0.13}, {"name": "Myricetin", "unit": "mg", "amount": 0}, {"name": "Quercetin", "unit": "mg", "amount": 3.7}, {"name": "Theaflavin-3,3'-digallate", "unit": "", "amount": 0}, {"name": "Theaflavin-3'-gallate", "unit": "", "amount": 0}, {"name": "Theaflavin-3-gallate", "unit": "", "amount": 0}, {"name": "Gallocatechin", "unit": "mg", "amount": 0}], "properties": [{"name": "Glycemic Index", "unit": "", "amount": 38.39}, {"name": "Glycemic Load", "unit": "", "amount": 18.48}, {"name": "Inflammation Score", "unit": "", "amount": -4}, {"name": "Nutrition Score", "unit": "%", "amount": 5.701739072799683}], "ingredients": [{"id": 19719, "name": "apricot jam", "unit": "tablespoons", "amount": 0.63, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 2.5, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 9.63, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0.04, "percentOfDailyNeeds": 11.87}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0.25, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0.5, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0.03, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 25.63, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0.09, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.13, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 1.1, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 8.05, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 5, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 0.38, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 8.01, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 5.43, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 30.25, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}]}, {"id": 20027, "name": "cornstarch", "unit": "teaspoon", "amount": 0.06, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 11.87}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 0.11, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.11, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 0.48, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}]}, {"id": 1125, "name": "egg yolk", "unit": "", "amount": 0.13, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 2.9, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 2.45, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.09, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 11.87}, {"name": "Saturated Fat", "unit": "g", "amount": 0.21, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 1.26, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0.11, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0.02, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0.6, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 32.44, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0.36, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 3.29, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.26, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.07, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 0.08, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 1.08, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0.12, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 24.3, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 18.45, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 8.77, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.08, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 7.24, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0.04, "percentOfDailyNeeds": 1.22}]}, {"id": 20081, "name": "flour", "unit": "cups", "amount": 0.17, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 3.13, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 22.29, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.09, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0.56, "percentOfDailyNeeds": 11.87}, {"name": "Saturated Fat", "unit": "g", "amount": 0.03, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 7.06, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 4.58, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0.06, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0.97, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0.2, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 2.15, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 38.13, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.16, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.09, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0.14, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 15.9, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.42, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0.15, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.1, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 2.17, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 1.23, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 22.5, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 15.34, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 0.06, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 75.83, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 32.08, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}]}, {"id": 1089003, "name": "granny smith apples", "unit": "", "amount": 0.5, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 5.46, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 97.37, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.05, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 2.18, "percentOfDailyNeeds": 11.87}, {"name": "Fluoride", "unit": "mg", "amount": 3, "percentOfDailyNeeds": 0}, {"name": "Saturated Fat", "unit": "g", "amount": 0.03, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 4.55, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 2, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0.11, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0.15, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 49.14, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0.24, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 2.73, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0.16, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 4.19, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 12.56, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.91, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 3.09, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.08, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 10.01, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 10.37, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 9.46, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 47.32, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}]}, {"id": 1012010, "name": "ground cinnamon", "unit": "teaspoon", "amount": 0.02, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.31, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 0.13, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 11.87}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0.01, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 0.09, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 0.03, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 0.08, "percentOfDailyNeeds": 12.43}, {"name": "Trans Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 2325.33}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}]}, {"id": 2025, "name": "pch ground nutmeg", "unit": "", "amount": 0.25, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.92, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 1.75, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0.1, "percentOfDailyNeeds": 11.87}, {"name": "Saturated Fat", "unit": "g", "amount": 0.13, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0.01, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0.92, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0.18, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 0.51, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0.03, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.38, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 8.82}, {"name": "Manganese", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 0.25, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.08, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 1.07, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.14, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 0.14, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 2.63, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}]}, {"id": 9152, "name": "lemon juice", "unit": "tablespoons", "amount": 0.25, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.22, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 3.86, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 11.87}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0.22, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 0.22, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.75, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 1.45, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 0.26, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0.19, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 0.3, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.25, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 0.09, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 0.82, "percentOfDailyNeeds": 12.43}, {"name": "Trans Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 2325.33}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}]}, {"id": 9156, "name": "lemon peel", "unit": "", "amount": 0.06, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.5, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 0.6, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0.04, "percentOfDailyNeeds": 11.87}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 0.19, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.05, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0.48, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.49}, {"name": "Carbohydrates", "unit": "g", "amount": 0.06, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 0.18, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}]}, {"id": 2064, "name": "mint", "unit": "sprigs", "amount": 0.13, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.3, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 0.71, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 30.5}, {"name": "Fiber", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 11.87}, {"name": "Magnesium", "unit": "mg", "amount": 0.1, "percentOfDailyNeeds": 2.97}, {"name": "Iron", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 5.31, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 6.28}, {"name": "Folate", "unit": "µg", "amount": 0.14, "percentOfDailyNeeds": 11.5}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 0.09, "percentOfDailyNeeds": 5.02}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 14.39}, {"name": "Calories", "unit": "kcal", "amount": 0.09, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}]}, {"id": 2047, "name": "pn salt", "unit": "servings", "amount": 1, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.12, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 11.87}, {"name": "Fluoride", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 0}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 193.79, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 0, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}]}, {"id": 19335, "name": "sugar", "unit": "tablespoons", "amount": 0.38, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 0.09, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 11.87}, {"name": "Fluoride", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0.03, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 4.48, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 4.48, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 4.49, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 17.33, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.22}]}, {"id": 1145, "name": "butter", "unit": "cup", "amount": 0.03, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 1.7, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 1.7, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.22, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 11.87}, {"name": "Fluoride", "unit": "mg", "amount": 0.2, "percentOfDailyNeeds": 0}, {"name": "Saturated Fat", "unit": "g", "amount": 3.64, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0.07, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0.14, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0.5, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 5.75, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 177.27, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0.06, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.21, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0.16, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 1.49, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.78, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0.11, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 15.25, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 1.33, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 1.7, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 50.86, "percentOfDailyNeeds": 12.43}, {"name": "Trans Fat", "unit": "g", "amount": 0.23, "percentOfDailyNeeds": 2325.33}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0.01, "percentOfDailyNeeds": 1.22}]}, {"id": 14412, "name": "water", "unit": "teaspoons", "amount": 0.25, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 2.42}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.91}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 11.87}, {"name": "Fluoride", "unit": "mg", "amount": 0.32, "percentOfDailyNeeds": 0}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.73}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.88}, {"name": "Magnesium", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 2.97}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 6.28}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.02}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 14.39}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Calories", "unit": "kcal", "amount": 0, "percentOfDailyNeeds": 12.43}, {"name": "Potassium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.27}]}, {"id": 1054, "name": "whipped cream", "unit": "servings", "amount": 1, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 6.06, "percentOfDailyNeeds": 2.42}, {"name": "Potassium", "unit": "mg", "amount": 8.82, "percentOfDailyNeeds": 4.27}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.05, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 11.87}, {"name": "Fluoride", "unit": "mg", "amount": 0.18, "percentOfDailyNeeds": 0}, {"name": "Saturated Fat", "unit": "g", "amount": 0.83, "percentOfDailyNeeds": 30.5}, {"name": "Selenium", "unit": "µg", "amount": 0.08, "percentOfDailyNeeds": 12.53}, {"name": "Magnesium", "unit": "mg", "amount": 0.66, "percentOfDailyNeeds": 2.97}, {"name": "Vitamin K", "unit": "µg", "amount": 0.11, "percentOfDailyNeeds": 2.57}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.88}, {"name": "Fat", "unit": "g", "amount": 1.33, "percentOfDailyNeeds": 12.73}, {"name": "Vitamin A", "unit": "IU", "amount": 41.1, "percentOfDailyNeeds": 6.64}, {"name": "Protein", "unit": "g", "amount": 0.19, "percentOfDailyNeeds": 6.28}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.18, "percentOfDailyNeeds": 11.5}, {"name": "Vitamin E", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 3.07}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.89}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.39, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.57}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 2.49}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.16}, {"name": "Carbohydrates", "unit": "g", "amount": 0.75, "percentOfDailyNeeds": 14.18}, {"name": "Sodium", "unit": "mg", "amount": 0.48, "percentOfDailyNeeds": 8.82}, {"name": "Zinc", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 1.91}, {"name": "Vitamin D", "unit": "µg", "amount": 0.02, "percentOfDailyNeeds": 1.68}, {"name": "Cholesterol", "unit": "mg", "amount": 4.56, "percentOfDailyNeeds": 14.7}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.82}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 1.01, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.69}, {"name": "Phosphorus", "unit": "mg", "amount": 5.34, "percentOfDailyNeeds": 5.02}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.75, "percentOfDailyNeeds": 14.39}, {"name": "Sugar", "unit": "g", "amount": 0.48, "percentOfDailyNeeds": 22.43}, {"name": "Calories", "unit": "kcal", "amount": 15.42, "percentOfDailyNeeds": 12.43}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.15}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0.02, "percentOfDailyNeeds": 1.22}]}], "caloricBreakdown": {"percentFat": 28.95, "percentCarbs": 66.17, "percentProtein": 4.88}, "weightPerServing": {"unit": "g", "amount": 151}}	8	2026-02-18 18:14:11.334926
4	Moist and Tender Lemon Cake	spoonacular	1095774	https://www.foodista.com/recipe/NX8V4YNX/moist-and-tender-lemon-cake	\N	2026-02-17 17:22:57.441708+00	{"nutrients": [{"name": "Calories", "unit": "kcal", "amount": 284.93, "percentOfDailyNeeds": 14.25}, {"name": "Fat", "unit": "g", "amount": 11.89, "percentOfDailyNeeds": 18.3}, {"name": "Saturated Fat", "unit": "g", "amount": 7.27, "percentOfDailyNeeds": 45.45}, {"name": "Carbohydrates", "unit": "g", "amount": 42.75, "percentOfDailyNeeds": 14.25}, {"name": "Net Carbohydrates", "unit": "g", "amount": 42.16, "percentOfDailyNeeds": 15.33}, {"name": "Sugar", "unit": "g", "amount": 32.09, "percentOfDailyNeeds": 35.66}, {"name": "Cholesterol", "unit": "mg", "amount": 67.79, "percentOfDailyNeeds": 22.6}, {"name": "Sodium", "unit": "mg", "amount": 105.61, "percentOfDailyNeeds": 4.59}, {"name": "Alcohol", "unit": "g", "amount": 0.06, "percentOfDailyNeeds": 100}, {"name": "Alcohol %", "unit": "%", "amount": 0.09, "percentOfDailyNeeds": 100}, {"name": "Protein", "unit": "g", "amount": 2.88, "percentOfDailyNeeds": 5.77}, {"name": "Selenium", "unit": "µg", "amount": 7.91, "percentOfDailyNeeds": 11.3}, {"name": "Vitamin A", "unit": "IU", "amount": 373.76, "percentOfDailyNeeds": 7.48}, {"name": "Folate", "unit": "µg", "amount": 29.41, "percentOfDailyNeeds": 7.35}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.12, "percentOfDailyNeeds": 7.21}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.11, "percentOfDailyNeeds": 7.12}, {"name": "Vitamin C", "unit": "mg", "amount": 4.77, "percentOfDailyNeeds": 5.78}, {"name": "Iron", "unit": "mg", "amount": 0.85, "percentOfDailyNeeds": 4.73}, {"name": "Manganese", "unit": "mg", "amount": 0.09, "percentOfDailyNeeds": 4.62}, {"name": "Phosphorus", "unit": "mg", "amount": 41.56, "percentOfDailyNeeds": 4.16}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.76, "percentOfDailyNeeds": 3.81}, {"name": "Vitamin E", "unit": "mg", "amount": 0.43, "percentOfDailyNeeds": 2.84}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.25, "percentOfDailyNeeds": 2.54}, {"name": "Fiber", "unit": "g", "amount": 0.59, "percentOfDailyNeeds": 2.36}, {"name": "Vitamin B12", "unit": "µg", "amount": 0.12, "percentOfDailyNeeds": 1.99}, {"name": "Calcium", "unit": "mg", "amount": 18.52, "percentOfDailyNeeds": 1.85}, {"name": "Zinc", "unit": "mg", "amount": 0.25, "percentOfDailyNeeds": 1.66}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 1.59}, {"name": "Copper", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 1.55}, {"name": "Vitamin D", "unit": "µg", "amount": 0.22, "percentOfDailyNeeds": 1.47}, {"name": "Potassium", "unit": "mg", "amount": 44.7, "percentOfDailyNeeds": 1.28}, {"name": "Magnesium", "unit": "mg", "amount": 5.08, "percentOfDailyNeeds": 1.27}], "flavonoids": [{"name": "Cyanidin", "unit": "", "amount": 0}, {"name": "Petunidin", "unit": "", "amount": 0}, {"name": "Delphinidin", "unit": "", "amount": 0}, {"name": "Malvidin", "unit": "", "amount": 0}, {"name": "Pelargonidin", "unit": "", "amount": 0}, {"name": "Peonidin", "unit": "", "amount": 0}, {"name": "Catechin", "unit": "", "amount": 0}, {"name": "Epigallocatechin", "unit": "", "amount": 0}, {"name": "Epicatechin", "unit": "", "amount": 0}, {"name": "Epicatechin 3-gallate", "unit": "", "amount": 0}, {"name": "Epigallocatechin 3-gallate", "unit": "", "amount": 0}, {"name": "Theaflavin", "unit": "", "amount": 0}, {"name": "Thearubigins", "unit": "", "amount": 0}, {"name": "Eriodictyol", "unit": "mg", "amount": 1.92}, {"name": "Hesperetin", "unit": "mg", "amount": 2.51}, {"name": "Naringenin", "unit": "mg", "amount": 0.05}, {"name": "Apigenin", "unit": "mg", "amount": 0}, {"name": "Luteolin", "unit": "mg", "amount": 0.17}, {"name": "Isorhamnetin", "unit": "", "amount": 0}, {"name": "Kaempferol", "unit": "mg", "amount": 0}, {"name": "Myricetin", "unit": "mg", "amount": 0.05}, {"name": "Quercetin", "unit": "mg", "amount": 0.1}, {"name": "Theaflavin-3,3'-digallate", "unit": "", "amount": 0}, {"name": "Theaflavin-3'-gallate", "unit": "", "amount": 0}, {"name": "Theaflavin-3-gallate", "unit": "", "amount": 0}, {"name": "Gallocatechin", "unit": "", "amount": 0}], "properties": [{"name": "Glycemic Index", "unit": "", "amount": 13.02}, {"name": "Glycemic Load", "unit": "", "amount": 15.8}, {"name": "Inflammation Score", "unit": "", "amount": -3}, {"name": "Nutrition Score", "unit": "%", "amount": 3.689565202464228}], "ingredients": [{"id": 1001, "name": "butter", "unit": "g", "amount": 12.5, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 3, "percentOfDailyNeeds": 1.85}, {"name": "Potassium", "unit": "mg", "amount": 3, "percentOfDailyNeeds": 1.28}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.38, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0.13, "percentOfDailyNeeds": 11.3}, {"name": "Saturated Fat", "unit": "g", "amount": 6.42, "percentOfDailyNeeds": 45.45}, {"name": "Fluoride", "unit": "mg", "amount": 0.35, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 2.36}, {"name": "Vitamin A", "unit": "IU", "amount": 312.38, "percentOfDailyNeeds": 7.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0.88, "percentOfDailyNeeds": 0.9}, {"name": "Fat", "unit": "g", "amount": 10.14, "percentOfDailyNeeds": 18.3}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.73}, {"name": "Magnesium", "unit": "mg", "amount": 0.25, "percentOfDailyNeeds": 1.27}, {"name": "Protein", "unit": "g", "amount": 0.11, "percentOfDailyNeeds": 5.77}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.38, "percentOfDailyNeeds": 7.35}, {"name": "Vitamin E", "unit": "mg", "amount": 0.29, "percentOfDailyNeeds": 2.84}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.55}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 2.63, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.78}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.62}, {"name": "Carbohydrates", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 14.25}, {"name": "Zinc", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 1.66}, {"name": "Sodium", "unit": "mg", "amount": 80.38, "percentOfDailyNeeds": 4.59}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.21}, {"name": "Cholesterol", "unit": "mg", "amount": 26.88, "percentOfDailyNeeds": 22.6}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.47}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 2.35, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 3.81}, {"name": "Phosphorus", "unit": "mg", "amount": 3, "percentOfDailyNeeds": 4.16}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 15.33}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 35.66}, {"name": "Calories", "unit": "kcal", "amount": 89.63, "percentOfDailyNeeds": 14.25}, {"name": "Trans Fat", "unit": "g", "amount": 0.41, "percentOfDailyNeeds": 4139.3}, {"name": "Vitamin B12", "unit": "µg", "amount": 0.02, "percentOfDailyNeeds": 1.99}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.59}]}, {"id": 19335, "name": "sugar", "unit": "g", "amount": 12.5, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.13, "percentOfDailyNeeds": 1.85}, {"name": "Potassium", "unit": "mg", "amount": 0.25, "percentOfDailyNeeds": 1.28}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0.07, "percentOfDailyNeeds": 11.3}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 45.45}, {"name": "Fluoride", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 2.36}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 7.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.9}, {"name": "Fat", "unit": "g", "amount": 0.04, "percentOfDailyNeeds": 18.3}, {"name": "Iron", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 4.73}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.27}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 5.77}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 7.35}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.55}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.78}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.62}, {"name": "Carbohydrates", "unit": "g", "amount": 12.45, "percentOfDailyNeeds": 14.25}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.66}, {"name": "Sodium", "unit": "mg", "amount": 0.13, "percentOfDailyNeeds": 4.59}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.21}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.6}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.47}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.81}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.16}, {"name": "Net Carbohydrates", "unit": "g", "amount": 12.45, "percentOfDailyNeeds": 15.33}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 12.47, "percentOfDailyNeeds": 35.66}, {"name": "Calories", "unit": "kcal", "amount": 48.13, "percentOfDailyNeeds": 14.25}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.99}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.59}]}, {"id": 2050, "name": "vanilla extract", "unit": "teaspoon", "amount": 0.04, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 1.85}, {"name": "Potassium", "unit": "mg", "amount": 0.25, "percentOfDailyNeeds": 1.28}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 11.3}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 45.45}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 2.36}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 7.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.9}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 18.3}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.73}, {"name": "Magnesium", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 1.27}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 5.77}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 7.35}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.55}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.78}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.62}, {"name": "Carbohydrates", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 14.25}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.66}, {"name": "Sodium", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 4.59}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.21}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.6}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.47}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.81}, {"name": "Phosphorus", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 4.16}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 15.33}, {"name": "Alcohol", "unit": "g", "amount": 0.06, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 35.66}, {"name": "Calories", "unit": "kcal", "amount": 0.48, "percentOfDailyNeeds": 14.25}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.99}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.59}]}, {"id": 1123, "name": "eggs", "unit": "", "amount": 0.25, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 6.16, "percentOfDailyNeeds": 1.85}, {"name": "Potassium", "unit": "mg", "amount": 15.18, "percentOfDailyNeeds": 1.28}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.21, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 3.38, "percentOfDailyNeeds": 11.3}, {"name": "Saturated Fat", "unit": "g", "amount": 0.34, "percentOfDailyNeeds": 45.45}, {"name": "Fluoride", "unit": "mg", "amount": 0.12, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 2.36}, {"name": "Vitamin A", "unit": "IU", "amount": 59.4, "percentOfDailyNeeds": 7.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0.03, "percentOfDailyNeeds": 0.9}, {"name": "Fat", "unit": "g", "amount": 1.05, "percentOfDailyNeeds": 18.3}, {"name": "Iron", "unit": "mg", "amount": 0.19, "percentOfDailyNeeds": 4.73}, {"name": "Magnesium", "unit": "mg", "amount": 1.32, "percentOfDailyNeeds": 1.27}, {"name": "Protein", "unit": "g", "amount": 1.39, "percentOfDailyNeeds": 5.77}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 5.17, "percentOfDailyNeeds": 7.35}, {"name": "Vitamin E", "unit": "mg", "amount": 0.12, "percentOfDailyNeeds": 2.84}, {"name": "Copper", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 1.55}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.4, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.78}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.17, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.62}, {"name": "Carbohydrates", "unit": "g", "amount": 0.08, "percentOfDailyNeeds": 14.25}, {"name": "Zinc", "unit": "mg", "amount": 0.14, "percentOfDailyNeeds": 1.66}, {"name": "Sodium", "unit": "mg", "amount": 15.62, "percentOfDailyNeeds": 4.59}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 7.21}, {"name": "Cholesterol", "unit": "mg", "amount": 40.92, "percentOfDailyNeeds": 22.6}, {"name": "Vitamin D", "unit": "µg", "amount": 0.22, "percentOfDailyNeeds": 1.47}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 32.34, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 3.81}, {"name": "Phosphorus", "unit": "mg", "amount": 21.78, "percentOfDailyNeeds": 4.16}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.08, "percentOfDailyNeeds": 15.33}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0.04, "percentOfDailyNeeds": 35.66}, {"name": "Calories", "unit": "kcal", "amount": 15.73, "percentOfDailyNeeds": 14.25}, {"name": "Trans Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 4139.3}, {"name": "Vitamin B12", "unit": "µg", "amount": 0.1, "percentOfDailyNeeds": 1.99}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 1.59}]}, {"id": 9150, "name": "lemons", "unit": "", "amount": 0.08, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 2.34, "percentOfDailyNeeds": 1.85}, {"name": "Potassium", "unit": "mg", "amount": 12.42, "percentOfDailyNeeds": 1.28}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0.04, "percentOfDailyNeeds": 11.3}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 45.45}, {"name": "Fiber", "unit": "g", "amount": 0.25, "percentOfDailyNeeds": 2.36}, {"name": "Vitamin A", "unit": "IU", "amount": 1.98, "percentOfDailyNeeds": 7.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.9}, {"name": "Fat", "unit": "g", "amount": 0.03, "percentOfDailyNeeds": 18.3}, {"name": "Iron", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 4.73}, {"name": "Magnesium", "unit": "mg", "amount": 0.72, "percentOfDailyNeeds": 1.27}, {"name": "Protein", "unit": "g", "amount": 0.1, "percentOfDailyNeeds": 5.77}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.99, "percentOfDailyNeeds": 7.35}, {"name": "Vitamin E", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 2.84}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.55}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.12}, {"name": "Vitamin C", "unit": "mg", "amount": 4.77, "percentOfDailyNeeds": 5.78}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.62}, {"name": "Carbohydrates", "unit": "g", "amount": 0.84, "percentOfDailyNeeds": 14.25}, {"name": "Zinc", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 1.66}, {"name": "Sodium", "unit": "mg", "amount": 0.18, "percentOfDailyNeeds": 4.59}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.21}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.6}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.47}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0.46, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 3.81}, {"name": "Phosphorus", "unit": "mg", "amount": 1.44, "percentOfDailyNeeds": 4.16}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.59, "percentOfDailyNeeds": 15.33}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0.23, "percentOfDailyNeeds": 35.66}, {"name": "Calories", "unit": "kcal", "amount": 2.61, "percentOfDailyNeeds": 14.25}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.99}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 1.59}]}, {"id": 20081, "name": "flour", "unit": "g", "amount": 12.5, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 1.88, "percentOfDailyNeeds": 1.85}, {"name": "Potassium", "unit": "mg", "amount": 13.38, "percentOfDailyNeeds": 1.28}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.05, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 4.24, "percentOfDailyNeeds": 11.3}, {"name": "Saturated Fat", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 45.45}, {"name": "Fiber", "unit": "g", "amount": 0.34, "percentOfDailyNeeds": 2.36}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 7.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0.04, "percentOfDailyNeeds": 0.9}, {"name": "Fat", "unit": "g", "amount": 0.12, "percentOfDailyNeeds": 18.3}, {"name": "Iron", "unit": "mg", "amount": 0.58, "percentOfDailyNeeds": 4.73}, {"name": "Magnesium", "unit": "mg", "amount": 2.75, "percentOfDailyNeeds": 1.27}, {"name": "Protein", "unit": "g", "amount": 1.29, "percentOfDailyNeeds": 5.77}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 22.88, "percentOfDailyNeeds": 7.35}, {"name": "Vitamin E", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 2.84}, {"name": "Copper", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 1.55}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.1, "percentOfDailyNeeds": 7.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.78}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0.09, "percentOfDailyNeeds": 4.62}, {"name": "Carbohydrates", "unit": "g", "amount": 9.54, "percentOfDailyNeeds": 14.25}, {"name": "Zinc", "unit": "mg", "amount": 0.09, "percentOfDailyNeeds": 1.66}, {"name": "Sodium", "unit": "mg", "amount": 0.25, "percentOfDailyNeeds": 4.59}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 7.21}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.6}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.47}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 1.3, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.74, "percentOfDailyNeeds": 3.81}, {"name": "Phosphorus", "unit": "mg", "amount": 13.5, "percentOfDailyNeeds": 4.16}, {"name": "Net Carbohydrates", "unit": "g", "amount": 9.2, "percentOfDailyNeeds": 15.33}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0.03, "percentOfDailyNeeds": 35.66}, {"name": "Calories", "unit": "kcal", "amount": 45.5, "percentOfDailyNeeds": 14.25}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.99}, {"name": "Folic Acid", "unit": "µg", "amount": 19.25, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 1.59}]}, {"id": 18369, "name": "baking powder", "unit": "teaspoon", "amount": 0.02, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 4.9, "percentOfDailyNeeds": 1.85}, {"name": "Potassium", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 1.28}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 11.3}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 45.45}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 2.36}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 7.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.9}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 18.3}, {"name": "Iron", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 4.73}, {"name": "Magnesium", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 1.27}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 5.77}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 7.35}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.55}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.78}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.62}, {"name": "Carbohydrates", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 14.25}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.66}, {"name": "Sodium", "unit": "mg", "amount": 8.83, "percentOfDailyNeeds": 4.59}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.21}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.6}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.47}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.81}, {"name": "Phosphorus", "unit": "mg", "amount": 1.83, "percentOfDailyNeeds": 4.16}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 15.33}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 35.66}, {"name": "Calories", "unit": "kcal", "amount": 0.04, "percentOfDailyNeeds": 14.25}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.99}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.59}]}, {"id": 19336, "name": "icing sugar", "unit": "g", "amount": 10.42, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.1, "percentOfDailyNeeds": 1.85}, {"name": "Potassium", "unit": "mg", "amount": 0.21, "percentOfDailyNeeds": 1.28}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0.06, "percentOfDailyNeeds": 11.3}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 45.45}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 2.36}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 7.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.9}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 18.3}, {"name": "Iron", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 4.73}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.27}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 5.77}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 7.35}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.55}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.78}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.62}, {"name": "Carbohydrates", "unit": "g", "amount": 10.4, "percentOfDailyNeeds": 14.25}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.66}, {"name": "Sodium", "unit": "mg", "amount": 0.21, "percentOfDailyNeeds": 4.59}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.21}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.6}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.47}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.81}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.16}, {"name": "Net Carbohydrates", "unit": "g", "amount": 10.4, "percentOfDailyNeeds": 15.33}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 10.19, "percentOfDailyNeeds": 35.66}, {"name": "Calories", "unit": "kcal", "amount": 40.52, "percentOfDailyNeeds": 14.25}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.99}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.59}]}, {"id": 93645, "name": "sprinkles", "unit": "servings", "amount": 1, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.85}, {"name": "Potassium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.28}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 11.3}, {"name": "Saturated Fat", "unit": "g", "amount": 0.48, "percentOfDailyNeeds": 45.45}, {"name": "Fluoride", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 2.36}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 7.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.9}, {"name": "Fat", "unit": "g", "amount": 0.52, "percentOfDailyNeeds": 18.3}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.73}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.27}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 5.77}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 7.35}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.55}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.78}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.62}, {"name": "Carbohydrates", "unit": "g", "amount": 9.4, "percentOfDailyNeeds": 14.25}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.66}, {"name": "Sodium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.59}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 7.21}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.6}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.47}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.81}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.16}, {"name": "Net Carbohydrates", "unit": "g", "amount": 9.4, "percentOfDailyNeeds": 15.33}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 9.1, "percentOfDailyNeeds": 35.66}, {"name": "Calories", "unit": "kcal", "amount": 42.3, "percentOfDailyNeeds": 14.25}, {"name": "Trans Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 4139.3}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.99}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 1.59}]}], "caloricBreakdown": {"percentFat": 36.96, "percentCarbs": 59.06, "percentProtein": 3.98}, "weightPerServing": {"unit": "g", "amount": 78}}	24	2026-02-18 18:14:15.131252
12	Pasta Margherita	spoonacular	511728	https://pickfreshfoods.com/pasta-margherita/	\N	2026-02-18 18:16:03.985226+00	{"nutrients": [{"name": "Calories", "unit": "kcal", "amount": 809.41, "percentOfDailyNeeds": 40.47}, {"name": "Fat", "unit": "g", "amount": 34.38, "percentOfDailyNeeds": 52.89}, {"name": "Saturated Fat", "unit": "g", "amount": 13.38, "percentOfDailyNeeds": 83.65}, {"name": "Carbohydrates", "unit": "g", "amount": 89.58, "percentOfDailyNeeds": 29.86}, {"name": "Net Carbohydrates", "unit": "g", "amount": 85.06, "percentOfDailyNeeds": 30.93}, {"name": "Sugar", "unit": "g", "amount": 5.78, "percentOfDailyNeeds": 6.42}, {"name": "Cholesterol", "unit": "mg", "amount": 67.19, "percentOfDailyNeeds": 22.4}, {"name": "Sodium", "unit": "mg", "amount": 834.74, "percentOfDailyNeeds": 36.29}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Alcohol %", "unit": "%", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Protein", "unit": "g", "amount": 34.36, "percentOfDailyNeeds": 68.72}, {"name": "Selenium", "unit": "µg", "amount": 86.24, "percentOfDailyNeeds": 123.2}, {"name": "Manganese", "unit": "mg", "amount": 1.18, "percentOfDailyNeeds": 58.83}, {"name": "Phosphorus", "unit": "mg", "amount": 534.39, "percentOfDailyNeeds": 53.44}, {"name": "Calcium", "unit": "mg", "amount": 464.72, "percentOfDailyNeeds": 46.47}, {"name": "Vitamin B12", "unit": "µg", "amount": 1.94, "percentOfDailyNeeds": 32.32}, {"name": "Zinc", "unit": "mg", "amount": 4.22, "percentOfDailyNeeds": 28.16}, {"name": "Vitamin A", "unit": "IU", "amount": 1244.5, "percentOfDailyNeeds": 24.89}, {"name": "Magnesium", "unit": "mg", "amount": 86.06, "percentOfDailyNeeds": 21.52}, {"name": "Vitamin K", "unit": "µg", "amount": 22.03, "percentOfDailyNeeds": 20.98}, {"name": "Copper", "unit": "mg", "amount": 0.39, "percentOfDailyNeeds": 19.36}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.32, "percentOfDailyNeeds": 19.07}, {"name": "Fiber", "unit": "g", "amount": 4.52, "percentOfDailyNeeds": 18.08}, {"name": "Vitamin E", "unit": "mg", "amount": 2.63, "percentOfDailyNeeds": 17.5}, {"name": "Potassium", "unit": "mg", "amount": 493.11, "percentOfDailyNeeds": 14.09}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.26, "percentOfDailyNeeds": 13.04}, {"name": "Vitamin C", "unit": "mg", "amount": 10.21, "percentOfDailyNeeds": 12.38}, {"name": "Vitamin B3", "unit": "mg", "amount": 2.46, "percentOfDailyNeeds": 12.28}, {"name": "Iron", "unit": "mg", "amount": 2.18, "percentOfDailyNeeds": 12.1}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.16, "percentOfDailyNeeds": 10.39}, {"name": "Folate", "unit": "µg", "amount": 38.04, "percentOfDailyNeeds": 9.51}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.68, "percentOfDailyNeeds": 6.79}, {"name": "Vitamin D", "unit": "µg", "amount": 0.34, "percentOfDailyNeeds": 2.27}], "flavonoids": [{"name": "Cyanidin", "unit": "mg", "amount": 0}, {"name": "Petunidin", "unit": "mg", "amount": 0}, {"name": "Delphinidin", "unit": "mg", "amount": 0}, {"name": "Malvidin", "unit": "mg", "amount": 0}, {"name": "Pelargonidin", "unit": "mg", "amount": 0}, {"name": "Peonidin", "unit": "mg", "amount": 0}, {"name": "Catechin", "unit": "mg", "amount": 0}, {"name": "Epigallocatechin", "unit": "mg", "amount": 0}, {"name": "Epicatechin", "unit": "mg", "amount": 0}, {"name": "Epicatechin 3-gallate", "unit": "mg", "amount": 0}, {"name": "Epigallocatechin 3-gallate", "unit": "mg", "amount": 0}, {"name": "Theaflavin", "unit": "", "amount": 0}, {"name": "Thearubigins", "unit": "", "amount": 0}, {"name": "Eriodictyol", "unit": "", "amount": 0}, {"name": "Hesperetin", "unit": "mg", "amount": 0}, {"name": "Naringenin", "unit": "mg", "amount": 0.48}, {"name": "Apigenin", "unit": "mg", "amount": 0.01}, {"name": "Luteolin", "unit": "mg", "amount": 0.02}, {"name": "Isorhamnetin", "unit": "mg", "amount": 0}, {"name": "Kaempferol", "unit": "mg", "amount": 0.07}, {"name": "Myricetin", "unit": "mg", "amount": 0.1}, {"name": "Quercetin", "unit": "mg", "amount": 0.42}, {"name": "Theaflavin-3,3'-digallate", "unit": "", "amount": 0}, {"name": "Theaflavin-3'-gallate", "unit": "", "amount": 0}, {"name": "Theaflavin-3-gallate", "unit": "", "amount": 0}, {"name": "Gallocatechin", "unit": "mg", "amount": 0}], "properties": [{"name": "Glycemic Index", "unit": "", "amount": 51.75}, {"name": "Glycemic Load", "unit": "", "amount": 35.35}, {"name": "Inflammation Score", "unit": "", "amount": -8}, {"name": "Nutrition Score", "unit": "%", "amount": 24.06391311728436}], "ingredients": [{"id": 2044, "name": "basil", "unit": "cup", "amount": 0.06, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 2.65, "percentOfDailyNeeds": 46.47}, {"name": "Potassium", "unit": "mg", "amount": 4.43, "percentOfDailyNeeds": 14.09}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 18.08}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 83.65}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 123.2}, {"name": "Magnesium", "unit": "mg", "amount": 0.96, "percentOfDailyNeeds": 21.52}, {"name": "Vitamin K", "unit": "µg", "amount": 6.22, "percentOfDailyNeeds": 20.98}, {"name": "Fat", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 52.89}, {"name": "Iron", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 12.1}, {"name": "Vitamin A", "unit": "IU", "amount": 79.13, "percentOfDailyNeeds": 24.89}, {"name": "Protein", "unit": "g", "amount": 0.05, "percentOfDailyNeeds": 68.72}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 1.02, "percentOfDailyNeeds": 9.51}, {"name": "Vitamin E", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 17.5}, {"name": "Copper", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 19.36}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.39}, {"name": "Vitamin C", "unit": "mg", "amount": 0.27, "percentOfDailyNeeds": 12.38}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.79}, {"name": "Manganese", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 58.83}, {"name": "Carbohydrates", "unit": "g", "amount": 0.04, "percentOfDailyNeeds": 29.86}, {"name": "Sodium", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 36.29}, {"name": "Zinc", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 28.16}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 19.07}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.4}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.27}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0.17, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 12.28}, {"name": "Phosphorus", "unit": "mg", "amount": 0.84, "percentOfDailyNeeds": 53.44}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 30.93}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 6.42}, {"name": "Calories", "unit": "kcal", "amount": 0.34, "percentOfDailyNeeds": 40.47}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 13.04}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 32.32}]}, {"id": 1021026, "name": "mozzarella cheese", "unit": "ounces", "amount": 3, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 429.5, "percentOfDailyNeeds": 46.47}, {"name": "Potassium", "unit": "mg", "amount": 64.64, "percentOfDailyNeeds": 14.09}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.65, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 18.08}, {"name": "Saturated Fat", "unit": "g", "amount": 11.19, "percentOfDailyNeeds": 83.65}, {"name": "Selenium", "unit": "µg", "amount": 14.46, "percentOfDailyNeeds": 123.2}, {"name": "Magnesium", "unit": "mg", "amount": 17.01, "percentOfDailyNeeds": 21.52}, {"name": "Vitamin K", "unit": "µg", "amount": 1.96, "percentOfDailyNeeds": 20.98}, {"name": "Fat", "unit": "g", "amount": 19.01, "percentOfDailyNeeds": 52.89}, {"name": "Iron", "unit": "mg", "amount": 0.37, "percentOfDailyNeeds": 12.1}, {"name": "Vitamin A", "unit": "IU", "amount": 574.93, "percentOfDailyNeeds": 24.89}, {"name": "Protein", "unit": "g", "amount": 18.86, "percentOfDailyNeeds": 68.72}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 5.95, "percentOfDailyNeeds": 9.51}, {"name": "Vitamin E", "unit": "mg", "amount": 0.16, "percentOfDailyNeeds": 17.5}, {"name": "Copper", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 19.36}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 5.59, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 10.39}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.38}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.12, "percentOfDailyNeeds": 6.79}, {"name": "Manganese", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 58.83}, {"name": "Carbohydrates", "unit": "g", "amount": 1.86, "percentOfDailyNeeds": 29.86}, {"name": "Sodium", "unit": "mg", "amount": 533.25, "percentOfDailyNeeds": 36.29}, {"name": "Zinc", "unit": "mg", "amount": 2.48, "percentOfDailyNeeds": 28.16}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.24, "percentOfDailyNeeds": 19.07}, {"name": "Cholesterol", "unit": "mg", "amount": 67.19, "percentOfDailyNeeds": 22.4}, {"name": "Vitamin D", "unit": "µg", "amount": 0.34, "percentOfDailyNeeds": 2.27}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 13.1, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.09, "percentOfDailyNeeds": 12.28}, {"name": "Phosphorus", "unit": "mg", "amount": 301.07, "percentOfDailyNeeds": 53.44}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 1.86, "percentOfDailyNeeds": 30.93}, {"name": "Sugar", "unit": "g", "amount": 0.88, "percentOfDailyNeeds": 6.42}, {"name": "Calories", "unit": "kcal", "amount": 255.15, "percentOfDailyNeeds": 40.47}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 13.04}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 1.94, "percentOfDailyNeeds": 32.32}]}, {"id": 10211215, "name": "garlic clove", "unit": "", "amount": 0.25, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 1.36, "percentOfDailyNeeds": 46.47}, {"name": "Potassium", "unit": "mg", "amount": 3.01, "percentOfDailyNeeds": 14.09}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 18.08}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 83.65}, {"name": "Selenium", "unit": "µg", "amount": 0.11, "percentOfDailyNeeds": 123.2}, {"name": "Magnesium", "unit": "mg", "amount": 0.19, "percentOfDailyNeeds": 21.52}, {"name": "Vitamin K", "unit": "µg", "amount": 0.01, "percentOfDailyNeeds": 20.98}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 52.89}, {"name": "Iron", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 12.1}, {"name": "Vitamin A", "unit": "IU", "amount": 0.07, "percentOfDailyNeeds": 24.89}, {"name": "Protein", "unit": "g", "amount": 0.05, "percentOfDailyNeeds": 68.72}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.02, "percentOfDailyNeeds": 9.51}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 17.5}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 19.36}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.39}, {"name": "Vitamin C", "unit": "mg", "amount": 0.23, "percentOfDailyNeeds": 12.38}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.79}, {"name": "Manganese", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 58.83}, {"name": "Carbohydrates", "unit": "g", "amount": 0.25, "percentOfDailyNeeds": 29.86}, {"name": "Sodium", "unit": "mg", "amount": 0.13, "percentOfDailyNeeds": 36.29}, {"name": "Zinc", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 28.16}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 19.07}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.4}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.27}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0.17, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 12.28}, {"name": "Phosphorus", "unit": "mg", "amount": 1.15, "percentOfDailyNeeds": 53.44}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.23, "percentOfDailyNeeds": 30.93}, {"name": "Sugar", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 6.42}, {"name": "Calories", "unit": "kcal", "amount": 1.12, "percentOfDailyNeeds": 40.47}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 13.04}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 32.32}]}, {"id": 10111529, "name": "grape tomatoes", "unit": "oz", "amount": 2.5, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 7.09, "percentOfDailyNeeds": 46.47}, {"name": "Potassium", "unit": "mg", "amount": 167.97, "percentOfDailyNeeds": 14.09}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.06, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0.85, "percentOfDailyNeeds": 18.08}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 123.2}, {"name": "Saturated Fat", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 83.65}, {"name": "Fluoride", "unit": "mg", "amount": 1.63, "percentOfDailyNeeds": 0}, {"name": "Magnesium", "unit": "mg", "amount": 7.8, "percentOfDailyNeeds": 21.52}, {"name": "Vitamin K", "unit": "µg", "amount": 5.6, "percentOfDailyNeeds": 20.98}, {"name": "Fat", "unit": "g", "amount": 0.14, "percentOfDailyNeeds": 52.89}, {"name": "Iron", "unit": "mg", "amount": 0.19, "percentOfDailyNeeds": 12.1}, {"name": "Vitamin A", "unit": "IU", "amount": 590.38, "percentOfDailyNeeds": 24.89}, {"name": "Protein", "unit": "g", "amount": 0.62, "percentOfDailyNeeds": 68.72}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 10.63, "percentOfDailyNeeds": 9.51}, {"name": "Vitamin E", "unit": "mg", "amount": 0.38, "percentOfDailyNeeds": 17.5}, {"name": "Copper", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 19.36}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.02, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 10.39}, {"name": "Vitamin C", "unit": "mg", "amount": 9.71, "percentOfDailyNeeds": 12.38}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 6.79}, {"name": "Manganese", "unit": "mg", "amount": 0.08, "percentOfDailyNeeds": 58.83}, {"name": "Carbohydrates", "unit": "g", "amount": 2.76, "percentOfDailyNeeds": 29.86}, {"name": "Sodium", "unit": "mg", "amount": 3.54, "percentOfDailyNeeds": 36.29}, {"name": "Zinc", "unit": "mg", "amount": 0.12, "percentOfDailyNeeds": 28.16}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 19.07}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.4}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.27}, {"name": "Lycopene", "unit": "µg", "amount": 1821.46, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 4.75, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.42, "percentOfDailyNeeds": 12.28}, {"name": "Phosphorus", "unit": "mg", "amount": 17.01, "percentOfDailyNeeds": 53.44}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 1.91, "percentOfDailyNeeds": 30.93}, {"name": "Sugar", "unit": "g", "amount": 1.86, "percentOfDailyNeeds": 6.42}, {"name": "Calories", "unit": "kcal", "amount": 12.76, "percentOfDailyNeeds": 40.47}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 13.04}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 32.32}]}, {"id": 1082047, "name": "kosher salt", "unit": "tsp", "amount": 0.13, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.18, "percentOfDailyNeeds": 46.47}, {"name": "Potassium", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 14.09}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 18.08}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 123.2}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 83.65}, {"name": "Fluoride", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 0}, {"name": "Magnesium", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 21.52}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 20.98}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 52.89}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.1}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 24.89}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 68.72}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 9.51}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 17.5}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 19.36}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.39}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.38}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.79}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 58.83}, {"name": "Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 29.86}, {"name": "Sodium", "unit": "mg", "amount": 290.68, "percentOfDailyNeeds": 36.29}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 28.16}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 19.07}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.4}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.27}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.28}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 53.44}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 30.93}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 6.42}, {"name": "Calories", "unit": "kcal", "amount": 0, "percentOfDailyNeeds": 40.47}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 13.04}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 32.32}]}, {"id": 1034053, "name": "olive oil", "unit": "cup", "amount": 0.06, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.14, "percentOfDailyNeeds": 46.47}, {"name": "Potassium", "unit": "mg", "amount": 0.14, "percentOfDailyNeeds": 14.09}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 1.42, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 18.08}, {"name": "Saturated Fat", "unit": "g", "amount": 1.86, "percentOfDailyNeeds": 83.65}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 123.2}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 21.52}, {"name": "Vitamin K", "unit": "µg", "amount": 8.13, "percentOfDailyNeeds": 20.98}, {"name": "Fat", "unit": "g", "amount": 13.5, "percentOfDailyNeeds": 52.89}, {"name": "Iron", "unit": "mg", "amount": 0.08, "percentOfDailyNeeds": 12.1}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 24.89}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 68.72}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 9.51}, {"name": "Vitamin E", "unit": "mg", "amount": 1.94, "percentOfDailyNeeds": 17.5}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 19.36}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 9.85, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.39}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.38}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.79}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 58.83}, {"name": "Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 29.86}, {"name": "Sodium", "unit": "mg", "amount": 0.27, "percentOfDailyNeeds": 36.29}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 28.16}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 19.07}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.4}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.27}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.28}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 53.44}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 30.93}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 6.42}, {"name": "Calories", "unit": "kcal", "amount": 119.34, "percentOfDailyNeeds": 40.47}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 13.04}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 32.32}]}, {"id": 20420, "name": "linguine pasta", "unit": "pound", "amount": 0.25, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 23.81, "percentOfDailyNeeds": 46.47}, {"name": "Potassium", "unit": "mg", "amount": 252.88, "percentOfDailyNeeds": 14.09}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.64, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 71.67, "percentOfDailyNeeds": 123.2}, {"name": "Saturated Fat", "unit": "g", "amount": 0.31, "percentOfDailyNeeds": 83.65}, {"name": "Fiber", "unit": "g", "amount": 3.63, "percentOfDailyNeeds": 18.08}, {"name": "Magnesium", "unit": "mg", "amount": 60.1, "percentOfDailyNeeds": 21.52}, {"name": "Vitamin K", "unit": "µg", "amount": 0.11, "percentOfDailyNeeds": 20.98}, {"name": "Fat", "unit": "g", "amount": 1.71, "percentOfDailyNeeds": 52.89}, {"name": "Iron", "unit": "mg", "amount": 1.47, "percentOfDailyNeeds": 12.1}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 24.89}, {"name": "Protein", "unit": "g", "amount": 14.79, "percentOfDailyNeeds": 68.72}, {"name": "Folate", "unit": "µg", "amount": 20.41, "percentOfDailyNeeds": 9.51}, {"name": "Vitamin E", "unit": "mg", "amount": 0.12, "percentOfDailyNeeds": 17.5}, {"name": "Copper", "unit": "mg", "amount": 0.33, "percentOfDailyNeeds": 19.36}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.19, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.1, "percentOfDailyNeeds": 10.39}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 12.38}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.49, "percentOfDailyNeeds": 6.79}, {"name": "Manganese", "unit": "mg", "amount": 1.04, "percentOfDailyNeeds": 58.83}, {"name": "Carbohydrates", "unit": "g", "amount": 84.67, "percentOfDailyNeeds": 29.86}, {"name": "Sodium", "unit": "mg", "amount": 6.8, "percentOfDailyNeeds": 36.29}, {"name": "Zinc", "unit": "mg", "amount": 1.6, "percentOfDailyNeeds": 28.16}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.07, "percentOfDailyNeeds": 19.07}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 22.4}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.27}, {"name": "Vitamin B3", "unit": "mg", "amount": 1.93, "percentOfDailyNeeds": 12.28}, {"name": "Phosphorus", "unit": "mg", "amount": 214.32, "percentOfDailyNeeds": 53.44}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Net Carbohydrates", "unit": "g", "amount": 81.05, "percentOfDailyNeeds": 30.93}, {"name": "Sugar", "unit": "g", "amount": 3.03, "percentOfDailyNeeds": 6.42}, {"name": "Calories", "unit": "kcal", "amount": 420.71, "percentOfDailyNeeds": 40.47}, {"name": "Trans Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.16, "percentOfDailyNeeds": 13.04}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 32.32}]}], "caloricBreakdown": {"percentFat": 38.43, "percentCarbs": 44.5, "percentProtein": 17.07}, "weightPerServing": {"unit": "g", "amount": 286}}	4	2026-02-18 18:16:06.688715
1	Fast Apple pie	spoonacular	642608	https://www.foodista.com/recipe/XYZBXFDL/fast-apple-pie	\N	2026-02-17 16:29:27.610008+00	{"nutrients": [{"name": "Calories", "unit": "kcal", "amount": 373.19, "percentOfDailyNeeds": 18.66}, {"name": "Fat", "unit": "g", "amount": 19.13, "percentOfDailyNeeds": 29.44}, {"name": "Saturated Fat", "unit": "g", "amount": 4.12, "percentOfDailyNeeds": 25.75}, {"name": "Carbohydrates", "unit": "g", "amount": 48.13, "percentOfDailyNeeds": 16.04}, {"name": "Net Carbohydrates", "unit": "g", "amount": 45, "percentOfDailyNeeds": 16.37}, {"name": "Sugar", "unit": "g", "amount": 21.61, "percentOfDailyNeeds": 24.01}, {"name": "Cholesterol", "unit": "mg", "amount": 1.59, "percentOfDailyNeeds": 0.53}, {"name": "Sodium", "unit": "mg", "amount": 247.74, "percentOfDailyNeeds": 10.77}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Alcohol %", "unit": "%", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Protein", "unit": "g", "amount": 3.97, "percentOfDailyNeeds": 7.95}, {"name": "Vitamin A", "unit": "IU", "amount": 873.86, "percentOfDailyNeeds": 17.48}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.26, "percentOfDailyNeeds": 17.12}, {"name": "Selenium", "unit": "µg", "amount": 10.52, "percentOfDailyNeeds": 15.03}, {"name": "Folate", "unit": "µg", "amount": 58.72, "percentOfDailyNeeds": 14.68}, {"name": "Manganese", "unit": "mg", "amount": 0.28, "percentOfDailyNeeds": 14.14}, {"name": "Fiber", "unit": "g", "amount": 3.13, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.2, "percentOfDailyNeeds": 11.76}, {"name": "Vitamin B3", "unit": "mg", "amount": 1.87, "percentOfDailyNeeds": 9.36}, {"name": "Iron", "unit": "mg", "amount": 1.56, "percentOfDailyNeeds": 8.67}, {"name": "Phosphorus", "unit": "mg", "amount": 64.44, "percentOfDailyNeeds": 6.44}, {"name": "Vitamin E", "unit": "mg", "amount": 0.9, "percentOfDailyNeeds": 5.99}, {"name": "Vitamin C", "unit": "mg", "amount": 4.29, "percentOfDailyNeeds": 5.2}, {"name": "Calcium", "unit": "mg", "amount": 47.81, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 159.09, "percentOfDailyNeeds": 4.55}, {"name": "Copper", "unit": "mg", "amount": 0.07, "percentOfDailyNeeds": 3.53}, {"name": "Magnesium", "unit": "mg", "amount": 13.51, "percentOfDailyNeeds": 3.38}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 2.84}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.25, "percentOfDailyNeeds": 2.54}, {"name": "Zinc", "unit": "mg", "amount": 0.32, "percentOfDailyNeeds": 2.16}, {"name": "Vitamin K", "unit": "µg", "amount": 2.19, "percentOfDailyNeeds": 2.09}, {"name": "Vitamin B12", "unit": "µg", "amount": 0.07, "percentOfDailyNeeds": 1.13}], "flavonoids": [{"name": "Cyanidin", "unit": "mg", "amount": 1.42}, {"name": "Petunidin", "unit": "mg", "amount": 0}, {"name": "Delphinidin", "unit": "mg", "amount": 0}, {"name": "Malvidin", "unit": "mg", "amount": 0}, {"name": "Pelargonidin", "unit": "mg", "amount": 0}, {"name": "Peonidin", "unit": "mg", "amount": 0.02}, {"name": "Catechin", "unit": "mg", "amount": 1.18}, {"name": "Epigallocatechin", "unit": "mg", "amount": 0.24}, {"name": "Epicatechin", "unit": "mg", "amount": 6.83}, {"name": "Epicatechin 3-gallate", "unit": "mg", "amount": 0.01}, {"name": "Epigallocatechin 3-gallate", "unit": "mg", "amount": 0.17}, {"name": "Theaflavin", "unit": "", "amount": 0}, {"name": "Thearubigins", "unit": "", "amount": 0}, {"name": "Eriodictyol", "unit": "", "amount": 0}, {"name": "Hesperetin", "unit": "mg", "amount": 0}, {"name": "Naringenin", "unit": "mg", "amount": 0}, {"name": "Apigenin", "unit": "mg", "amount": 0}, {"name": "Luteolin", "unit": "mg", "amount": 0.11}, {"name": "Isorhamnetin", "unit": "", "amount": 0}, {"name": "Kaempferol", "unit": "mg", "amount": 0.13}, {"name": "Myricetin", "unit": "mg", "amount": 0}, {"name": "Quercetin", "unit": "mg", "amount": 3.64}, {"name": "Theaflavin-3,3'-digallate", "unit": "", "amount": 0}, {"name": "Theaflavin-3'-gallate", "unit": "", "amount": 0}, {"name": "Theaflavin-3-gallate", "unit": "", "amount": 0}, {"name": "Gallocatechin", "unit": "mg", "amount": 0}], "properties": [{"name": "Glycemic Index", "unit": "", "amount": 18.16}, {"name": "Glycemic Load", "unit": "", "amount": 22.62}, {"name": "Inflammation Score", "unit": "", "amount": -7}, {"name": "Nutrition Score", "unit": "%", "amount": 7.1934782920972165}], "ingredients": [{"id": 18369, "name": "baking powder", "unit": "tsp", "amount": 0.05, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 13.51, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 4.55}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 15.03}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 25.75}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 17.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.09}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 29.44}, {"name": "Iron", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 8.67}, {"name": "Magnesium", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 3.38}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 7.95}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 14.68}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.99}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.53}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 17.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.2}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.14}, {"name": "Carbohydrates", "unit": "g", "amount": 0.06, "percentOfDailyNeeds": 16.04}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.16}, {"name": "Sodium", "unit": "mg", "amount": 24.38, "percentOfDailyNeeds": 10.77}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 11.76}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0.53}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.08}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 9.36}, {"name": "Phosphorus", "unit": "mg", "amount": 5.04, "percentOfDailyNeeds": 6.44}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.06, "percentOfDailyNeeds": 16.37}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 24.01}, {"name": "Calories", "unit": "kcal", "amount": 0.12, "percentOfDailyNeeds": 18.66}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.13}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}]}, {"id": 2010, "name": "cinnamon", "unit": "tsp", "amount": 0.1, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 2.61, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 1.12, "percentOfDailyNeeds": 4.55}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0.01, "percentOfDailyNeeds": 15.03}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 25.75}, {"name": "Fiber", "unit": "g", "amount": 0.14, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin A", "unit": "IU", "amount": 0.77, "percentOfDailyNeeds": 17.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0.08, "percentOfDailyNeeds": 2.09}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 29.44}, {"name": "Iron", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 8.67}, {"name": "Magnesium", "unit": "mg", "amount": 0.16, "percentOfDailyNeeds": 3.38}, {"name": "Protein", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 7.95}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.02, "percentOfDailyNeeds": 14.68}, {"name": "Vitamin E", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 5.99}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.53}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 17.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 5.2}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 14.14}, {"name": "Carbohydrates", "unit": "g", "amount": 0.21, "percentOfDailyNeeds": 16.04}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.16}, {"name": "Sodium", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 10.77}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 11.76}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0.53}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.08}, {"name": "Lycopene", "unit": "µg", "amount": 0.04, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 9.36}, {"name": "Phosphorus", "unit": "mg", "amount": 0.17, "percentOfDailyNeeds": 6.44}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.07, "percentOfDailyNeeds": 16.37}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 24.01}, {"name": "Calories", "unit": "kcal", "amount": 0.64, "percentOfDailyNeeds": 18.66}, {"name": "Trans Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.13}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}]}, {"id": 20081, "name": "flour", "unit": "gr", "amount": 30, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 4.5, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 32.1, "percentOfDailyNeeds": 4.55}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.12, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 10.17, "percentOfDailyNeeds": 15.03}, {"name": "Saturated Fat", "unit": "g", "amount": 0.05, "percentOfDailyNeeds": 25.75}, {"name": "Fiber", "unit": "g", "amount": 0.81, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 17.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0.09, "percentOfDailyNeeds": 2.09}, {"name": "Fat", "unit": "g", "amount": 0.29, "percentOfDailyNeeds": 29.44}, {"name": "Iron", "unit": "mg", "amount": 1.39, "percentOfDailyNeeds": 8.67}, {"name": "Magnesium", "unit": "mg", "amount": 6.6, "percentOfDailyNeeds": 3.38}, {"name": "Protein", "unit": "g", "amount": 3.1, "percentOfDailyNeeds": 7.95}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 54.9, "percentOfDailyNeeds": 14.68}, {"name": "Vitamin E", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 5.99}, {"name": "Copper", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 3.53}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.03, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.24, "percentOfDailyNeeds": 17.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.2}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.13, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0.2, "percentOfDailyNeeds": 14.14}, {"name": "Carbohydrates", "unit": "g", "amount": 22.89, "percentOfDailyNeeds": 16.04}, {"name": "Zinc", "unit": "mg", "amount": 0.21, "percentOfDailyNeeds": 2.16}, {"name": "Sodium", "unit": "mg", "amount": 0.6, "percentOfDailyNeeds": 10.77}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.15, "percentOfDailyNeeds": 11.76}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0.53}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.08}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 3.12, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 1.77, "percentOfDailyNeeds": 9.36}, {"name": "Phosphorus", "unit": "mg", "amount": 32.4, "percentOfDailyNeeds": 6.44}, {"name": "Net Carbohydrates", "unit": "g", "amount": 22.08, "percentOfDailyNeeds": 16.37}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0.08, "percentOfDailyNeeds": 24.01}, {"name": "Calories", "unit": "kcal", "amount": 109.2, "percentOfDailyNeeds": 18.66}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.13}, {"name": "Folic Acid", "unit": "µg", "amount": 46.2, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 2.84}]}, {"id": 1089003, "name": "granny smith apples", "unit": "pounds", "amount": 0.2, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 5.44, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 97.07, "percentOfDailyNeeds": 4.55}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.05, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 15.03}, {"name": "Saturated Fat", "unit": "g", "amount": 0.03, "percentOfDailyNeeds": 25.75}, {"name": "Fluoride", "unit": "mg", "amount": 2.99, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 2.18, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin A", "unit": "IU", "amount": 48.99, "percentOfDailyNeeds": 17.48}, {"name": "Vitamin K", "unit": "µg", "amount": 2, "percentOfDailyNeeds": 2.09}, {"name": "Fat", "unit": "g", "amount": 0.15, "percentOfDailyNeeds": 29.44}, {"name": "Iron", "unit": "mg", "amount": 0.11, "percentOfDailyNeeds": 8.67}, {"name": "Magnesium", "unit": "mg", "amount": 4.54, "percentOfDailyNeeds": 3.38}, {"name": "Protein", "unit": "g", "amount": 0.24, "percentOfDailyNeeds": 7.95}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 2.72, "percentOfDailyNeeds": 14.68}, {"name": "Vitamin E", "unit": "mg", "amount": 0.16, "percentOfDailyNeeds": 5.99}, {"name": "Copper", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 3.53}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 17.12}, {"name": "Vitamin C", "unit": "mg", "amount": 4.17, "percentOfDailyNeeds": 5.2}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0.03, "percentOfDailyNeeds": 14.14}, {"name": "Carbohydrates", "unit": "g", "amount": 12.52, "percentOfDailyNeeds": 16.04}, {"name": "Zinc", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 2.16}, {"name": "Sodium", "unit": "mg", "amount": 0.91, "percentOfDailyNeeds": 10.77}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 11.76}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0.53}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.08}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 3.08, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.08, "percentOfDailyNeeds": 9.36}, {"name": "Phosphorus", "unit": "mg", "amount": 9.98, "percentOfDailyNeeds": 6.44}, {"name": "Net Carbohydrates", "unit": "g", "amount": 10.34, "percentOfDailyNeeds": 16.37}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 9.43, "percentOfDailyNeeds": 24.01}, {"name": "Calories", "unit": "kcal", "amount": 47.17, "percentOfDailyNeeds": 18.66}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.13}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 2.84}]}, {"id": 4073, "name": "margarine", "unit": "cups", "amount": 0.1, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 6.81, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 9.53, "percentOfDailyNeeds": 4.55}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 4.74, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 15.03}, {"name": "Saturated Fat", "unit": "g", "amount": 3.79, "percentOfDailyNeeds": 25.75}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin A", "unit": "IU", "amount": 811.98, "percentOfDailyNeeds": 17.48}, {"name": "Fat", "unit": "g", "amount": 18.27, "percentOfDailyNeeds": 29.44}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.67}, {"name": "Magnesium", "unit": "mg", "amount": 0.68, "percentOfDailyNeeds": 3.38}, {"name": "Protein", "unit": "g", "amount": 0.2, "percentOfDailyNeeds": 7.95}, {"name": "Folate", "unit": "µg", "amount": 0.23, "percentOfDailyNeeds": 14.68}, {"name": "Vitamin E", "unit": "mg", "amount": 0.7, "percentOfDailyNeeds": 5.99}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 8.92, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 17.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 5.2}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 2.54}, {"name": "Carbohydrates", "unit": "g", "amount": 0.2, "percentOfDailyNeeds": 16.04}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.16}, {"name": "Sodium", "unit": "mg", "amount": 214.06, "percentOfDailyNeeds": 10.77}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 11.76}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0.53}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 9.36}, {"name": "Phosphorus", "unit": "mg", "amount": 5.22, "percentOfDailyNeeds": 6.44}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.2, "percentOfDailyNeeds": 16.37}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 24.01}, {"name": "Calories", "unit": "kcal", "amount": 163.21, "percentOfDailyNeeds": 18.66}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B12", "unit": "µg", "amount": 0.02, "percentOfDailyNeeds": 1.13}]}, {"id": 19336, "name": "powdered sugar", "unit": "servings", "amount": 1, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.08, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 0.16, "percentOfDailyNeeds": 4.55}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0.05, "percentOfDailyNeeds": 15.03}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 25.75}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 17.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.09}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 29.44}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.67}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.38}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 7.95}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 14.68}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.99}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.53}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 17.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.2}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.14}, {"name": "Carbohydrates", "unit": "g", "amount": 7.98, "percentOfDailyNeeds": 16.04}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.16}, {"name": "Sodium", "unit": "mg", "amount": 0.16, "percentOfDailyNeeds": 10.77}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 11.76}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0.53}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.08}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 9.36}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.44}, {"name": "Net Carbohydrates", "unit": "g", "amount": 7.98, "percentOfDailyNeeds": 16.37}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 7.82, "percentOfDailyNeeds": 24.01}, {"name": "Calories", "unit": "kcal", "amount": 31.12, "percentOfDailyNeeds": 18.66}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.13}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}]}, {"id": 2047, "name": "salt", "unit": "pinch", "amount": 0.05, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.55}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 15.03}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 25.75}, {"name": "Fluoride", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 17.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.09}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 29.44}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.67}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.38}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 7.95}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 14.68}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.99}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.53}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 17.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.2}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.14}, {"name": "Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 16.04}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.16}, {"name": "Sodium", "unit": "mg", "amount": 1.94, "percentOfDailyNeeds": 10.77}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 11.76}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0.53}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.08}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 9.36}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.44}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0, "percentOfDailyNeeds": 16.37}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0, "percentOfDailyNeeds": 24.01}, {"name": "Calories", "unit": "kcal", "amount": 0, "percentOfDailyNeeds": 18.66}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.13}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}]}, {"id": 19335, "name": "sugar", "unit": "tbsp", "amount": 0.3, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 0.07, "percentOfDailyNeeds": 4.55}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0.02, "percentOfDailyNeeds": 15.03}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 25.75}, {"name": "Fluoride", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 17.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.09}, {"name": "Fat", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 29.44}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.67}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.38}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 7.95}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 14.68}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.99}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.53}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 17.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.2}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.14}, {"name": "Carbohydrates", "unit": "g", "amount": 3.59, "percentOfDailyNeeds": 16.04}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.16}, {"name": "Sodium", "unit": "mg", "amount": 0.04, "percentOfDailyNeeds": 10.77}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 11.76}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0.53}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.08}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 9.36}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.44}, {"name": "Net Carbohydrates", "unit": "g", "amount": 3.59, "percentOfDailyNeeds": 16.37}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 3.59, "percentOfDailyNeeds": 24.01}, {"name": "Calories", "unit": "kcal", "amount": 13.86, "percentOfDailyNeeds": 18.66}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.13}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}]}, {"id": 10319335, "name": "sachets vanilla sugar", "unit": "", "amount": 0.1, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 4.55}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 15.03}, {"name": "Saturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 25.75}, {"name": "Fluoride", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin A", "unit": "IU", "amount": 0, "percentOfDailyNeeds": 17.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 2.09}, {"name": "Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 29.44}, {"name": "Iron", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 8.67}, {"name": "Magnesium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.38}, {"name": "Protein", "unit": "g", "amount": 0, "percentOfDailyNeeds": 7.95}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 14.68}, {"name": "Vitamin E", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.99}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.53}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 17.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 5.2}, {"name": "Vitamin B5", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.14}, {"name": "Carbohydrates", "unit": "g", "amount": 0.1, "percentOfDailyNeeds": 16.04}, {"name": "Zinc", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.16}, {"name": "Sodium", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 10.77}, {"name": "Vitamin B2", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 11.76}, {"name": "Cholesterol", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0.53}, {"name": "Vitamin D", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0.08}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 9.36}, {"name": "Phosphorus", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 6.44}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.1, "percentOfDailyNeeds": 16.37}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0.1, "percentOfDailyNeeds": 24.01}, {"name": "Calories", "unit": "kcal", "amount": 0.38, "percentOfDailyNeeds": 18.66}, {"name": "Vitamin B12", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 1.13}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}]}, {"id": 1116, "name": "yogurt", "unit": "cup", "amount": 0.05, "nutrients": [{"name": "Calcium", "unit": "mg", "amount": 14.82, "percentOfDailyNeeds": 4.78}, {"name": "Potassium", "unit": "mg", "amount": 18.99, "percentOfDailyNeeds": 4.55}, {"name": "Poly Unsaturated Fat", "unit": "g", "amount": 0.01, "percentOfDailyNeeds": 0}, {"name": "Selenium", "unit": "µg", "amount": 0.27, "percentOfDailyNeeds": 15.03}, {"name": "Saturated Fat", "unit": "g", "amount": 0.26, "percentOfDailyNeeds": 25.75}, {"name": "Fluoride", "unit": "mg", "amount": 1.47, "percentOfDailyNeeds": 0}, {"name": "Fiber", "unit": "g", "amount": 0, "percentOfDailyNeeds": 12.5}, {"name": "Vitamin A", "unit": "IU", "amount": 12.13, "percentOfDailyNeeds": 17.48}, {"name": "Vitamin K", "unit": "µg", "amount": 0.02, "percentOfDailyNeeds": 2.09}, {"name": "Fat", "unit": "g", "amount": 0.4, "percentOfDailyNeeds": 29.44}, {"name": "Iron", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 8.67}, {"name": "Magnesium", "unit": "mg", "amount": 1.47, "percentOfDailyNeeds": 3.38}, {"name": "Protein", "unit": "g", "amount": 0.43, "percentOfDailyNeeds": 7.95}, {"name": "Caffeine", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Folate", "unit": "µg", "amount": 0.86, "percentOfDailyNeeds": 14.68}, {"name": "Vitamin E", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 5.99}, {"name": "Copper", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 3.53}, {"name": "Mono Unsaturated Fat", "unit": "g", "amount": 0.11, "percentOfDailyNeeds": 0}, {"name": "Vitamin B1", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 17.12}, {"name": "Vitamin C", "unit": "mg", "amount": 0.06, "percentOfDailyNeeds": 5.2}, {"name": "Vitamin B5", "unit": "mg", "amount": 0.05, "percentOfDailyNeeds": 2.54}, {"name": "Manganese", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 14.14}, {"name": "Carbohydrates", "unit": "g", "amount": 0.57, "percentOfDailyNeeds": 16.04}, {"name": "Zinc", "unit": "mg", "amount": 0.07, "percentOfDailyNeeds": 2.16}, {"name": "Sodium", "unit": "mg", "amount": 5.63, "percentOfDailyNeeds": 10.77}, {"name": "Vitamin B2", "unit": "mg", "amount": 0.02, "percentOfDailyNeeds": 11.76}, {"name": "Cholesterol", "unit": "mg", "amount": 1.59, "percentOfDailyNeeds": 0.53}, {"name": "Vitamin D", "unit": "µg", "amount": 0.01, "percentOfDailyNeeds": 0.08}, {"name": "Lycopene", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Choline", "unit": "mg", "amount": 1.86, "percentOfDailyNeeds": 0}, {"name": "Vitamin B3", "unit": "mg", "amount": 0.01, "percentOfDailyNeeds": 9.36}, {"name": "Phosphorus", "unit": "mg", "amount": 11.64, "percentOfDailyNeeds": 6.44}, {"name": "Net Carbohydrates", "unit": "g", "amount": 0.57, "percentOfDailyNeeds": 16.37}, {"name": "Alcohol", "unit": "g", "amount": 0, "percentOfDailyNeeds": 100}, {"name": "Sugar", "unit": "g", "amount": 0.57, "percentOfDailyNeeds": 24.01}, {"name": "Calories", "unit": "kcal", "amount": 7.47, "percentOfDailyNeeds": 18.66}, {"name": "Vitamin B12", "unit": "µg", "amount": 0.05, "percentOfDailyNeeds": 1.13}, {"name": "Folic Acid", "unit": "µg", "amount": 0, "percentOfDailyNeeds": 0}, {"name": "Vitamin B6", "unit": "mg", "amount": 0, "percentOfDailyNeeds": 2.84}]}], "caloricBreakdown": {"percentFat": 45.24, "percentCarbs": 50.58, "percentProtein": 4.18}, "weightPerServing": {"unit": "g", "amount": 168}}	20	2026-02-18 18:53:51.621793
\.


--
-- TOC entry 4957 (class 0 OID 16504)
-- Dependencies: 224
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stores (id, name) FROM stdin;
1	Tesco
2	Aldi
3	Lidl
4	No store
\.


--
-- TOC entry 4969 (class 0 OID 16625)
-- Dependencies: 236
-- Data for Name: user_product_prices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_product_prices (id, user_id, product_id, store_id, last_price, updated_at) FROM stdin;
1	1	32	\N	1.90	2026-02-24 17:55:50.926261
2	1	33	3	1.40	2026-02-24 17:57:30.726369
\.


--
-- TOC entry 4962 (class 0 OID 16535)
-- Dependencies: 229
-- Data for Name: user_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_products (id, user_id, product_id, store_id, expiry_date, expiry_period_days, notified) FROM stdin;
101	1	1	1	2026-02-13	\N	t
102	1	1	1	2026-02-10	\N	t
103	1	1	1	2026-02-15	0	t
104	1	1	1	2026-02-15	\N	t
105	1	1	1	2026-02-15	-1	t
106	1	27	1	\N	0	f
107	1	28	1	\N	0	f
108	1	29	3	\N	0	f
109	1	30	3	\N	0	f
110	1	31	1	\N	0	f
111	1	32	4	\N	0	f
112	1	33	3	\N	0	f
\.


--
-- TOC entry 4967 (class 0 OID 16593)
-- Dependencies: 234
-- Data for Name: user_saved_recipes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_saved_recipes (user_id, recipe_id, saved_at) FROM stdin;
1	4	2026-02-18 11:01:47.562863+00
1	10	2026-02-18 17:56:46.050731+00
1	12	2026-02-18 18:16:03.985226+00
1	1	2026-02-18 18:53:33.854691+00
\.


--
-- TOC entry 4959 (class 0 OID 16511)
-- Dependencies: 226
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password, notification_period_preference) FROM stdin;
2	lucian	pass2	2
3	aisven	pass3	2
1	roonaldo	pass1	7
\.


--
-- TOC entry 4984 (class 0 OID 0)
-- Dependencies: 217
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 5, true);


--
-- TOC entry 4985 (class 0 OID 0)
-- Dependencies: 219
-- Name: food_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.food_types_id_seq', 5, true);


--
-- TOC entry 4986 (class 0 OID 0)
-- Dependencies: 221
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 33, true);


--
-- TOC entry 4987 (class 0 OID 0)
-- Dependencies: 232
-- Name: recipe_ingredients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recipe_ingredients_id_seq', 57, true);


--
-- TOC entry 4988 (class 0 OID 0)
-- Dependencies: 230
-- Name: recipes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recipes_id_seq', 14, true);


--
-- TOC entry 4989 (class 0 OID 0)
-- Dependencies: 223
-- Name: stores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stores_id_seq', 4, true);


--
-- TOC entry 4990 (class 0 OID 0)
-- Dependencies: 228
-- Name: user_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_product_id_seq', 112, true);


--
-- TOC entry 4991 (class 0 OID 0)
-- Dependencies: 235
-- Name: user_product_prices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_product_prices_id_seq', 2, true);


--
-- TOC entry 4992 (class 0 OID 0)
-- Dependencies: 225
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- TOC entry 4760 (class 2606 OID 16478)
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- TOC entry 4762 (class 2606 OID 16476)
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4764 (class 2606 OID 16485)
-- Name: food_types food_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_types
    ADD CONSTRAINT food_types_pkey PRIMARY KEY (id);


--
-- TOC entry 4774 (class 2606 OID 16523)
-- Name: product_store product_store_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_store
    ADD CONSTRAINT product_store_pkey PRIMARY KEY (product_id, store_id);


--
-- TOC entry 4766 (class 2606 OID 16497)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 4783 (class 2606 OID 16581)
-- Name: recipe_ingredients recipe_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id);


--
-- TOC entry 4778 (class 2606 OID 16564)
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- TOC entry 4780 (class 2606 OID 16566)
-- Name: recipes recipes_source_external_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_source_external_id_key UNIQUE (source, external_id);


--
-- TOC entry 4768 (class 2606 OID 16509)
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- TOC entry 4776 (class 2606 OID 16540)
-- Name: user_products user_product_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_products
    ADD CONSTRAINT user_product_pkey PRIMARY KEY (id);


--
-- TOC entry 4788 (class 2606 OID 16631)
-- Name: user_product_prices user_product_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_product_prices
    ADD CONSTRAINT user_product_prices_pkey PRIMARY KEY (id);


--
-- TOC entry 4790 (class 2606 OID 16633)
-- Name: user_product_prices user_product_prices_user_id_product_id_store_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_product_prices
    ADD CONSTRAINT user_product_prices_user_id_product_id_store_id_key UNIQUE (user_id, product_id, store_id);


--
-- TOC entry 4786 (class 2606 OID 16598)
-- Name: user_saved_recipes user_saved_recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_recipes
    ADD CONSTRAINT user_saved_recipes_pkey PRIMARY KEY (user_id, recipe_id);


--
-- TOC entry 4770 (class 2606 OID 16516)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4772 (class 2606 OID 16518)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4781 (class 1259 OID 16592)
-- Name: idx_recipe_ingredients_recipe_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recipe_ingredients_recipe_id ON public.recipe_ingredients USING btree (recipe_id);


--
-- TOC entry 4784 (class 1259 OID 16609)
-- Name: idx_user_saved_recipes_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_saved_recipes_user_id ON public.user_saved_recipes USING btree (user_id);


--
-- TOC entry 4795 (class 2606 OID 16546)
-- Name: user_products fk_user_product_store; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_products
    ADD CONSTRAINT fk_user_product_store FOREIGN KEY (product_id, store_id) REFERENCES public.product_store(product_id, store_id) ON DELETE CASCADE;


--
-- TOC entry 4791 (class 2606 OID 16486)
-- Name: food_types food_types_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.food_types
    ADD CONSTRAINT food_types_category_fkey FOREIGN KEY (category) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- TOC entry 4793 (class 2606 OID 16524)
-- Name: product_store product_store_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_store
    ADD CONSTRAINT product_store_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4794 (class 2606 OID 16529)
-- Name: product_store product_store_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_store
    ADD CONSTRAINT product_store_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- TOC entry 4792 (class 2606 OID 16498)
-- Name: products products_foodtype_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_foodtype_fkey FOREIGN KEY (food_type) REFERENCES public.food_types(id) ON DELETE CASCADE;


--
-- TOC entry 4798 (class 2606 OID 16587)
-- Name: recipe_ingredients recipe_ingredients_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- TOC entry 4799 (class 2606 OID 16610)
-- Name: recipe_ingredients recipe_ingredients_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- TOC entry 4797 (class 2606 OID 16567)
-- Name: recipes recipes_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4802 (class 2606 OID 16639)
-- Name: user_product_prices user_product_prices_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_product_prices
    ADD CONSTRAINT user_product_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4803 (class 2606 OID 16644)
-- Name: user_product_prices user_product_prices_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_product_prices
    ADD CONSTRAINT user_product_prices_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


--
-- TOC entry 4804 (class 2606 OID 16634)
-- Name: user_product_prices user_product_prices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_product_prices
    ADD CONSTRAINT user_product_prices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4796 (class 2606 OID 16541)
-- Name: user_products user_product_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_products
    ADD CONSTRAINT user_product_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4800 (class 2606 OID 16615)
-- Name: user_saved_recipes user_saved_recipes_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_recipes
    ADD CONSTRAINT user_saved_recipes_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- TOC entry 4801 (class 2606 OID 16599)
-- Name: user_saved_recipes user_saved_recipes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_recipes
    ADD CONSTRAINT user_saved_recipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2026-02-24 19:49:35

--
-- PostgreSQL database dump complete
--

