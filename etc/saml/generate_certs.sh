# Generate two x509 certificates and private keys:

openssl req -new -x509 -keyout encrypt.key.pem -out encrypt.cert.pem -days 365 -nodes
openssl req -new -x509 -keyout signing.key.pem -out signing.cert.pem -days 365 -nodes

# openssl req - The req command primarily creates and processes certificate requests in PKCS#10 format. It can additionally create self signed certificates for use as root CAs for example.

# Explanation of above command:
# -new: Create a new certificate request
# -x509: Create a x509 certificate
# -keyout: Output the private key to key.pem
# -out: Output the certificate to cert.pem
# -days: Set the certificate to expire in 365 days
# -nodes: Don't ask for any extra information
