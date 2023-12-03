CC = gcc
CFLAGS = -Wall -Wextra -pedantic -g
LDFLAGS = -lelf

TARGET = sym_reader
SRC = main.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

clean:
	rm -f $(TARGET)

