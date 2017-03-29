# Entities

## User
+ id
+ email
+ password
+ salt
+ first_name
+ last_name
+ organization
+ role (admin/user)

## Namespace
+ id
+ title
+ owners [user's id]
+ description
+ visible

## Lesson
+ id
+ namespace_id
+ title
+ description
+ active (whether the link to the lesson can be accessed)
+ public/private (within the context of the application)
  + default to private
+ metadata (JSON object) 


## SessionData
+ lesson_id
+ session_id
+ data (JSON object)

# Security
+ Restrict by namespace
+ All owners of the namespace has the same rights
