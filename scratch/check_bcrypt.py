try:
    import bcrypt
    print("bcrypt is available")
    h = bcrypt.hashpw(b"Password@123", bcrypt.gensalt(10))
    print("Hash:", h.decode('utf-8'))
    print("Matches dummy?", bcrypt.checkpw(b"Password@123", b"$2a$10$wT0lQn2L9K6U3B4gK.qO6eY1W8d0rO5mD6v8yN2zB8xK9pL0mN1q."))
except Exception as e:
    print("Error:", e)
