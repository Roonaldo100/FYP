create table categories (
  id serial primary key,
  name varchar(20) unique
);

create table food_types (
  id serial primary key,
  category int references categories(id),
  name varchar(20)
);
