#include <stdio.h>
#include <stdlib.h>
#include <gelf.h>
#include <fcntl.h>
#include <unistd.h>
#include <libelf.h>

void read_symbols(Elf *elf, Elf_Scn *symtab, const char * elf_out_path);
int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <elf_file> <out_path>\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    const char *elf_file_path = argv[1];

    if (elf_version(EV_CURRENT) == EV_NONE) {
        fprintf(stderr, "ELF library initialization failed: %s\n", elf_errmsg(-1));
        exit(EXIT_FAILURE);
    }

    int fd = open(elf_file_path, O_RDONLY);
    if (fd < 0) {
        perror("Error opening ELF file");
        exit(EXIT_FAILURE);
    }

    Elf *elf = elf_begin(fd, ELF_C_READ, NULL);
    if (!elf) {
        perror("Error initializing ELF descriptor");
        close(fd);
        exit(EXIT_FAILURE);
    }
    Elf_Scn *symtab = NULL;
    Elf_Scn *scn = NULL;
    while ((scn = elf_nextscn(elf, scn)) != NULL) {
        GElf_Shdr shdr;
        gelf_getshdr(scn, &shdr);

        if (shdr.sh_type == SHT_SYMTAB || shdr.sh_type == SHT_DYNSYM) {
            symtab = scn;
            break;
        }
    }

    if (!symtab) {
        fprintf(stderr, "Symbol table not found\n");
        elf_end(elf);
        close(fd);
        exit(EXIT_FAILURE);
    }
    const char * elf_out_path = argv[2];
    read_symbols(elf, symtab,elf_out_path);

    elf_end(elf);
    close(fd);

    return 0;
}

void read_symbols(Elf *elf, Elf_Scn *symtab, const char * elf_out_path) {
    GElf_Shdr shdr;
    gelf_getshdr(symtab, &shdr);

    Elf_Data *sym_data = elf_getdata(symtab, NULL);
    if (!sym_data) {
        fprintf(stderr, "Error reading symbol data\n");
        exit(EXIT_FAILURE);
    }

    size_t num_symbols = shdr.sh_size / shdr.sh_entsize;
    GElf_Sym *symbols = (GElf_Sym *)sym_data->d_buf;

    printf("Number of symbols: %zu\n", num_symbols);

    FILE * f = fopen(elf_out_path, "w");
    if (f == NULL)
        exit(EXIT_FAILURE);

    for (size_t i = 0; i < num_symbols; ++i) {
        const char *symbol_name = elf_strptr(elf, shdr.sh_link, symbols[i].st_name);
        if ((unsigned long long)symbols[i].st_value == 0ULL)
            continue;
        fprintf(f, "%s|0x%llx\n",
            symbol_name ? symbol_name : "<no-name>",
            (unsigned long long)symbols[i].st_value);

    }
}

