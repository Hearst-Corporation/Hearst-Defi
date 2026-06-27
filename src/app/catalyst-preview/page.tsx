"use client";

import "./catalyst-preview.css";

import { useState } from "react";

import { Button } from "@/components/catalyst/button";
import { Badge } from "@/components/catalyst/badge";
import { Input } from "@/components/catalyst/input";
import { Textarea } from "@/components/catalyst/textarea";
import { Select } from "@/components/catalyst/select";
import { Checkbox, CheckboxField } from "@/components/catalyst/checkbox";
import { Switch, SwitchField } from "@/components/catalyst/switch";
import { Radio, RadioField, RadioGroup } from "@/components/catalyst/radio";
import { Field, Label } from "@/components/catalyst/fieldset";
import { Heading, Subheading } from "@/components/catalyst/heading";
import { Text, TextLink, Strong, Code } from "@/components/catalyst/text";
import { Divider } from "@/components/catalyst/divider";
import { Avatar, AvatarGroup } from "@/components/catalyst/avatar";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/catalyst/table";
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "@/components/catalyst/dropdown";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "@/components/catalyst/dialog";
import {
  Alert,
  AlertTitle,
  AlertDescription,
  AlertActions,
} from "@/components/catalyst/alert";
import {
  Pagination,
  PaginationPrevious,
  PaginationNext,
  PaginationList,
  PaginationPage,
} from "@/components/catalyst/pagination";

import { PlusIcon } from '@heroicons/react/20/solid'

export default function CatalystPreviewPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [checked, setChecked] = useState(true);
  const [switched, setSwitched] = useState(true);
  const [radio, setRadio] = useState("yield");

  return (
    <div className="dark cat-page">
      <h1 className="cat-page-title">Catalyst — aperçu des 27 composants</h1>
      <p className="cat-page-sub">
        Rendu natif Catalyst (palette zinc, dark mode actif).
      </p>

      <div className="cat-gallery">
        {/* ── Boutons ── */}
        <section className="cat-section">
          <h2 className="cat-section__title">Buttons</h2>
          <div className="cat-row flex-wrap">
            <Button color="green" className="cat-accent-btn">Accent</Button>
            <Button color="dark/zinc">Default</Button>
            <Button outline>Outline</Button>
            <Button plain>Plain</Button>
            <Button disabled>Disabled</Button>
          </div>
          
          <h3 className="cat-section__title mt-8">Inset Ring Buttons (Pill)</h3>
          <div className="cat-row flex-wrap items-center">
            <Button insetRing className="px-2.5 py-1 text-xs">Button XS</Button>
            <Button insetRing className="px-2.5 py-1 text-sm">Button S</Button>
            <Button insetRing className="px-3 py-1.5 text-sm">Button M</Button>
            <Button insetRing className="px-3.5 py-2 text-sm">Button L</Button>
            <Button insetRing className="px-4 py-2.5 text-sm">Button XL</Button>
          </div>
          <h3 className="cat-section__title mt-8">Icon-only Buttons (Circular)</h3>
          <div className="cat-row flex-wrap items-center">
            <Button iconOnly color="indigo" className="p-1">
              <PlusIcon className="size-5" />
            </Button>
            <Button iconOnly color="indigo" className="p-1.5">
              <PlusIcon className="size-5" />
            </Button>
            <Button iconOnly color="indigo" className="p-2">
              <PlusIcon className="size-5" />
            </Button>
            {/* Avec notre vert accent */}
            <Button iconOnly color="green" className="p-1.5">
              <PlusIcon className="size-5" />
            </Button>
            {/* Variante neutre Zinc */}
            <Button iconOnly color="dark/zinc" className="p-1.5">
              <PlusIcon className="size-5" />
            </Button>
          </div>
        </section>

        {/* ── Badges ── */}
        <section className="cat-section">
          <h2 className="cat-section__title">Badges</h2>
          <div className="cat-row">
            <Badge color="green">Live</Badge>
            <Badge color="zinc">Estimated</Badge>
            <Badge color="amber">Pending</Badge>
            <Badge color="red">Stale</Badge>
            <Badge color="blue">Oracle</Badge>
          </div>
        </section>

        {/* ── Form fields ── */}
        <section className="cat-section">
          <h2 className="cat-section__title">Inputs &amp; form</h2>
          <Field>
            <Label>Email</Label>
            <Input type="email" placeholder="investor@fund.com" />
          </Field>
          <Field>
            <Label>Notes</Label>
            <Textarea placeholder="Internal note…" rows={3} />
          </Field>
          <Field>
            <Label>Vault</Label>
            <Select>
              <option>Hearst Yield Vault</option>
              <option>Defensive Vault</option>
              <option>BTC Plus Vault</option>
            </Select>
          </Field>
        </section>

        {/* ── Toggles ── */}
        <section className="cat-section">
          <h2 className="cat-section__title">Checkbox · Switch · Radio</h2>
          <CheckboxField>
            <Checkbox checked={checked} onChange={setChecked} />
            <Label>Accredited investor</Label>
          </CheckboxField>
          <SwitchField>
            <Switch checked={switched} onChange={setSwitched} />
            <Label>Monthly distributions</Label>
          </SwitchField>
          <RadioGroup value={radio} onChange={setRadio}>
            <RadioField>
              <Radio value="yield" />
              <Label>Yield</Label>
            </RadioField>
            <RadioField>
              <Radio value="defensive" />
              <Label>Defensive</Label>
            </RadioField>
          </RadioGroup>
        </section>

        {/* ── Typographie ── */}
        <section className="cat-section">
          <h2 className="cat-section__title">Typography</h2>
          <Heading>Portfolio overview</Heading>
          <Subheading>Capital &amp; yield</Subheading>
          <Text>
            Body text with a <TextLink href="#">link</TextLink>, some{" "}
            <Strong>strong</Strong> emphasis and inline <Code>--ct-accent</Code>.
          </Text>
          <Divider />
        </section>

        {/* ── Avatar + Dropdown ── */}
        <section className="cat-section">
          <h2 className="cat-section__title">Avatar &amp; Group</h2>
          <div className="cat-row">
            <Avatar initials="AD" className="size-10" />
            <Avatar initials="HY" className="size-10" />
            <Dropdown>
              <DropdownButton outline>Actions</DropdownButton>
              <DropdownMenu>
                <DropdownItem>View positions</DropdownItem>
                <DropdownItem>Export statement</DropdownItem>
                <DropdownItem>Settings</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
          
          <h3 className="cat-section__title mt-8">Avatar Groups</h3>
          <div className="flex flex-col gap-6">
            <AvatarGroup size="sm">
              <Avatar src="https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
              <Avatar src="https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
              <Avatar src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.25&w=256&h=256&q=80" />
              <Avatar src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
            </AvatarGroup>

            <AvatarGroup size="md">
              <Avatar src="https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
              <Avatar src="https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
              <Avatar src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.25&w=256&h=256&q=80" />
              <Avatar src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
            </AvatarGroup>

            <AvatarGroup size="lg">
              <Avatar src="https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
              <Avatar src="https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
              <Avatar src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.25&w=256&h=256&q=80" />
              <Avatar src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
            </AvatarGroup>
          </div>
        </section>

        {/* ── Table ── */}
        <section className="cat-section">
          <h2 className="cat-section__title">Table</h2>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Vault</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Value</TableHeader>
                <TableHeader>APY</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Hearst Yield</TableCell>
                <TableCell>
                  <Badge color="green">Active</Badge>
                </TableCell>
                <TableCell>$250,000</TableCell>
                <TableCell>9.4–12.8%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Defensive</TableCell>
                <TableCell>
                  <Badge color="zinc">Pending</Badge>
                </TableCell>
                <TableCell>$0</TableCell>
                <TableCell>—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        {/* ── Pagination ── */}
        <section className="cat-section">
          <h2 className="cat-section__title">Pagination</h2>
          <Pagination>
            <PaginationPrevious href="#" />
            <PaginationList>
              <PaginationPage href="#" current>
                1
              </PaginationPage>
              <PaginationPage href="#">2</PaginationPage>
              <PaginationPage href="#">3</PaginationPage>
            </PaginationList>
            <PaginationNext href="#" />
          </Pagination>
        </section>

        {/* ── Overlays ── */}
        <section className="cat-section">
          <h2 className="cat-section__title">Dialog &amp; Alert</h2>
          <div className="cat-row">
            <Button color="green" className="cat-accent-btn" onClick={() => setDialogOpen(true)}>
              Open dialog
            </Button>
            <Button outline onClick={() => setAlertOpen(true)}>
              Open alert
            </Button>
          </div>

          <Dialog open={dialogOpen} onClose={setDialogOpen}>
            <DialogTitle>Confirm subscription</DialogTitle>
            <DialogDescription>
              You are about to subscribe $250,000 to the Hearst Yield Vault.
            </DialogDescription>
            <DialogBody>
              <Text>Returns are a range and not guaranteed.</Text>
            </DialogBody>
            <DialogActions>
              <Button plain onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button color="green" className="cat-accent-btn" onClick={() => setDialogOpen(false)}>
                Confirm
              </Button>
            </DialogActions>
          </Dialog>

          <Alert open={alertOpen} onClose={setAlertOpen}>
            <AlertTitle>Withdraw position?</AlertTitle>
            <AlertDescription>
              This starts a 60-day soft lock-up unwind.
            </AlertDescription>
            <AlertActions>
              <Button plain onClick={() => setAlertOpen(false)}>
                Cancel
              </Button>
              <Button color="red" onClick={() => setAlertOpen(false)}>
                Withdraw
              </Button>
            </AlertActions>
          </Alert>
        </section>
      </div>
    </div>
  );
}
